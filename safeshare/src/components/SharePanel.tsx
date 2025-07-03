// components/SharePanel.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from 'socket.io-client'; // Import Socket.IO client library


import ReceiverBox from "./ReceiverBox";
import SenderBox from "./SenderBox";
import StatusDisplay from "./StatusDisplay";

// Define the FileMetadata interface (can be moved to a shared types file if project grows)
interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

// --- WebRTC Configuration ---
// STUN (Session Traversal Utilities for NAT) servers help WebRTC peers discover their public IP and port.
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};


const CHUNK_SIZE = 64 * 1024; // 64 Kilobytes


const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';


export default function SharePanel() {
  // --- Global UI State for Connection Status and Progress ---
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [transferProgress, setTransferProgress] = useState(0);

  // --- WebRTC Related Refs (to persist across renders) ---
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const socketRef = useRef<Socket | null>(null); // Socket.IO client instance
  const fileReaderRef = useRef<FileReader | null>(null); // For sending files
  const currentUserIdRef = useRef<string>(crypto.randomUUID()); // Unique ID for this client session

  // Function to display messages (now logs to console instead of showing modal)
  const showInfoMessage = useCallback((msg: string) => {
    console.log(`P2P Info: ${msg}`);
    
  }, []);

  // --- Sender Specific States ---
  const [fileToShare, setFileToShare] = useState<File | null>(null);
  const [shareCode, setShareCode] = useState<string>('');

  // --- Receiver Specific States ---
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [receivedFileMetadata, setReceivedFileMetadata] = useState<FileMetadata | null>(null);
  const [receivedChunks, setReceivedChunks] = useState<Blob[]>([]); // To accumulate file chunks
  const [currentReceivedBytes, setCurrentReceivedBytes] = useState(0); // To track total bytes received


  // --- Reset All Connections and UI State ---
  const resetAllUIState = useCallback(() => {
    // Close any active WebRTC connections and data channels
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (fileReaderRef.current) {
      fileReaderRef.current.abort(); // Abort any ongoing file reading
      fileReaderRef.current = null;
    }
    if (socketRef.current) {
        socketRef.current.disconnect(); // Disconnect Socket.IO
        socketRef.current = null;
    }

    // Reset all frontend states
    setFileToShare(null);
    setShareCode('');
    setEnteredCode('');
    setConnectionStatus('Disconnected');
    setTransferProgress(0);
    setReceivedFileMetadata(null);
    setReceivedChunks([]);
    setCurrentReceivedBytes(0);
    showInfoMessage('All connections and UI states reset.');
  }, [showInfoMessage]);



  const createPeerConnection = useCallback((isSender: boolean, currentShareCode: string) => {
    // Ensure previous connections are closed before creating new ones
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
    }

    peerConnectionRef.current = new RTCPeerConnection(ICE_SERVERS);
    setConnectionStatus('Connecting...');
    setTransferProgress(0); // Reset progress for new connection

    // --- ICE Candidate Handling ---
   
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        // Emit ICE candidate to the signaling server via Socket.IO
        socketRef.current?.emit('send-candidate', {
          shareCode: currentShareCode,
          candidate: event.candidate.toJSON(), // Convert RTCIceCandidate to a JSON object
          isSender: isSender,
        });
        console.log(`[WebRTC] Emitted ICE candidate (${isSender ? 'sender' : 'receiver'}) for code: ${currentShareCode}`);
      }
    };

    // --- Peer Connection State Change ---
   
    peerConnectionRef.current.onconnectionstatechange = () => {
      const state = peerConnectionRef.current?.connectionState || 'Unknown';
      setConnectionStatus(state);
      console.log(`[WebRTC] Connection state changed: ${state}`);
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        showInfoMessage('WebRTC connection disconnected or failed. Please try again.');
        resetAllUIState(); // Trigger full reset and cleanup
      } else if (state === 'connected') {
        showInfoMessage('WebRTC connection established!');
      }
    };

    // --- Data Channel Setup ---
    // If this peer is the sender, create the DataChannel.
    if (isSender) {
      dataChannelRef.current = peerConnectionRef.current.createDataChannel('fileShareChannel', {
        negotiated: true, // Indicates that the channel's negotiation is managed by the application
        id: 0,            // A fixed ID for the data channel, ensuring it's the same on both ends
        ordered: true,    // Guarantees that messages arrive in the order they were sent
      });
      console.log('[WebRTC] Sender: Data channel created.');
    } else {
      // If this peer is the receiver, listen for the DataChannel being created by the sender.
      peerConnectionRef.current.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        console.log('[WebRTC] Receiver: Data channel received.');
        setupDataChannelHandlers(currentShareCode); // Set up handlers once channel is received
      };
    }

    // --- Common Data Channel Handlers Setup ---
    // These handlers apply to the data channel once it's established (or received by receiver).
    const setupDataChannelHandlers = (code: string) => {
        if (!dataChannelRef.current) {
            console.error('[WebRTC] Data channel is null when trying to set up handlers.');
            return; // Ensure dataChannelRef.current is valid
        }

        dataChannelRef.current.onopen = () => {
            console.log('[DataChannel] Opened!');
            setConnectionStatus('Connected');
            // If sender, start sending once data channel is open AND a file is selected
            if (isSender && fileToShare) {
                sendFileChunks(code, fileToShare);
            }
        };

        dataChannelRef.current.onmessage = async (event) => {
            // Handle different types of incoming messages: signaling strings or file data chunks
            if (typeof event.data === 'string') {
                try {
                    const signal = JSON.parse(event.data);
                    if (signal.type === 'file-metadata') {
                        console.log('[DataChannel] Receiver: Received file metadata:', signal);
                        // Received file metadata from sender
                        setReceivedFileMetadata({
                            name: signal.fileName,
                            size: signal.fileSize,
                            type: signal.fileType,
                        });
                        // Reset receiver-side states for a new transfer
                        setReceivedChunks([]);
                        setCurrentReceivedBytes(0);
                        setTransferProgress(0);
                        showInfoMessage(`Receiving file: ${signal.fileName} (${(signal.fileSize / (1024 * 1024)).toFixed(2)} MB)...`);
                    } else if (signal.type === 'file-end') {
                        console.log('[DataChannel] Receiver: Received file-end signal. Transfer complete!');
                        setConnectionStatus('Download complete');
                        showInfoMessage('File transfer complete! Your download should start automatically.');

                        // Reassemble chunks into a Blob and trigger download
                        console.log('[DataChannel] Receiver: Attempting to create Blob from received chunks...');
                        const blob = new Blob(receivedChunks, { type: receivedFileMetadata?.type || 'application/octet-stream' });
                        console.log('[DataChannel] Receiver: Blob created:', blob);

                        const url = URL.createObjectURL(blob); // Create a temporary URL for the Blob
                        console.log('[DataChannel] Receiver: Object URL created:', url);

                        const a = document.createElement('a'); // Create a temporary anchor element
                        a.href = url;
                        a.download = receivedFileMetadata?.name || 'downloaded_file'; // Set download filename
                        document.body.appendChild(a); // Append to body (required for Firefox)
                        console.log('[DataChannel] Receiver: Triggering download...');
                        a.click(); // Programmatically click to trigger download
                        document.body.removeChild(a); // Clean up the anchor element
                        URL.revokeObjectURL(url); // Release the object URL to free memory
                        console.log('[DataChannel] Receiver: Download triggered and URL revoked.');

                        // Signal backend that transfer is completed (optional, for cleanup)
                        socketRef.current?.emit('transfer-completed', { shareCode: code });
                        console.log('[DataChannel] Receiver: Emitted transfer-completed to backend.');

                        // Reset receiver states after successful download
                        setReceivedFileMetadata(null);
                        setReceivedChunks([]);
                        setCurrentReceivedBytes(0);
                    }
                } catch (e) {
                    console.error('[DataChannel] Receiver: Error parsing signaling message:', e);
                    // Treat as a regular text message if not a valid JSON signal
                    console.log('[DataChannel] Receiver: Received unknown text message:', event.data);
                }
            } else if (event.data instanceof ArrayBuffer) {
                // It's a file chunk (binary data)
                const chunkBlob = new Blob([event.data]); // Create a Blob from the ArrayBuffer chunk
                setReceivedChunks((prev) => [...prev, chunkBlob]); // Append to the list of received chunks
                setCurrentReceivedBytes((prev) => {
                    const newBytes = prev + event.data.byteLength;
                    // Update progress if file metadata is available and size is not zero
                    if (receivedFileMetadata && receivedFileMetadata.size > 0) {
                        setTransferProgress((newBytes / receivedFileMetadata.size) * 100);
                    }
                    // console.log(`[DataChannel] Receiver: Received chunk, current bytes: ${newBytes}, progress: ${transferProgress.toFixed(2)}%`); // Very verbose
                    return newBytes;
                });
            }
        };

        dataChannelRef.current.onclose = () => {
            console.log('[DataChannel] Closed!');
            setConnectionStatus('Disconnected');
            showInfoMessage('Data channel closed.');
            resetAllUIState();
        };

        dataChannelRef.current.onerror = (error: any) => {
            console.error('[DataChannel] Error:', error);
            showInfoMessage(`Data channel error: ${error.error.message}`);
            resetAllUIState();
        };
    };

    // If sender, setup handlers now. If receiver, handlers set when ondatachannel fires.
    if (isSender && dataChannelRef.current) {
        setupDataChannelHandlers(currentShareCode);
    }

  }, [fileToShare, receivedChunks, receivedFileMetadata, setConnectionStatus, setTransferProgress, showInfoMessage, resetAllUIState, peerConnectionRef, dataChannelRef, currentUserIdRef]);


  // --- Sender Logic ---
  // Callback function passed to SenderBox to initiate sharing process
  const handleSenderStartSharing = useCallback(async (file: File) => {
    if (!file) {
      showInfoMessage('Please select a file to share.');
      return;
    }
    setFileToShare(file); // Ensure fileToShare state is set for sendFileChunks
    setConnectionStatus('Generating share code...');
    console.log('[Sender] Starting share process...');

    // Initialize Socket.IO connection if not already connected
    if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = io(BACKEND_URL); // Connect to your Node.js backend
        socketRef.current.on('connect', () => console.log('[Socket.IO] Connected.'));
        socketRef.current.on('disconnect', () => console.log('[Socket.IO] Disconnected.'));
        socketRef.current.on('connect_error', (err) => {
          console.error('[Socket.IO] Connection error:', err);
          showInfoMessage(`Failed to connect to signaling server: ${err.message}`);
          resetAllUIState();
        });
    } else {
        console.log('[Socket.IO] Already connected.');
    }

    // Emit 'create-transfer' event to backend to get a unique share code
    console.log('[Sender] Emitting create-transfer event...');
    socketRef.current?.emit('create-transfer', {
      fileMetadata: { name: file.name, size: file.size, type: file.type },
      senderId: currentUserIdRef.current,
    }, async (response: { success: boolean; shareCode?: string; message?: string }) => {
      console.log('[Sender] Received response for create-transfer:', response);
      if (response.success && response.shareCode) {
        const generatedCode = response.shareCode;
        setShareCode(generatedCode); // Store the generated share code
        setConnectionStatus('Waiting for recipient to connect...');
        showInfoMessage(`Share code generated: ${generatedCode}. Share this with the recipient.`); // Log share code

        console.log('[Sender] Creating WebRTC peer connection...');
        await createPeerConnection(true, generatedCode); // Initialize WebRTC peer connection as sender
        console.log('[Sender] WebRTC peer connection created.');

        // Create and send WebRTC Offer
        console.log('[Sender] Creating WebRTC offer...');
        const offer = await peerConnectionRef.current?.createOffer();
        console.log('[Sender] Setting local description (offer)...');
        await peerConnectionRef.current?.setLocalDescription(offer);
        console.log('[Sender] Emitting send-offer to signaling server...');
        socketRef.current?.emit('send-offer', {
          shareCode: generatedCode,
          offer: offer,
          senderId: currentUserIdRef.current,
        });

        // Listen for answer and candidates from the backend
        socketRef.current?.on('answer-received', async (data: { shareCode: string; answer: any }) => {
          console.log('[Sender] Answer received from backend:', data);
          if (data.shareCode === generatedCode && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
            
            const answer = new RTCSessionDescription(data.answer);
            await peerConnectionRef.current.setRemoteDescription(answer);
            setConnectionStatus('Recipient connected. Transferring...');
            showInfoMessage('Recipient connected. Starting transfer!');
          }
        });

        socketRef.current?.on('candidate-received', async (data: { shareCode: string; candidate: any; isSender: boolean }) => {
          console.log('[Sender] Candidate received from backend:', data);
          // Add candidate if it's from the other peer (receiver) and remote description is set
          if (data.shareCode === generatedCode && !data.isSender && peerConnectionRef.current?.remoteDescription) {
            try {
              const candidate = new RTCIceCandidate(data.candidate);
              await peerConnectionRef.current.addIceCandidate(candidate);
            } catch (e) {
              console.warn('[Sender] Error adding ICE candidate:', e);
            }
          }
        });

      } else {
        showInfoMessage(`Failed to generate share code: ${response.message || 'Unknown error'}`);
        setConnectionStatus('Error');
        resetAllUIState(); // Reset on failure
      }
    });
  }, [createPeerConnection, showInfoMessage, setConnectionStatus, resetAllUIState, fileToShare]);


  // Function to read file chunks and send them over the DataChannel
  const sendFileChunks = useCallback((currentShareCode: string, file: File) => {
    if (!file || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      showInfoMessage('Data channel not ready or no file selected to send.');
      return;
    }

    setConnectionStatus('Transferring...');
    setTransferProgress(0);
    console.log('[Sender] Sending file metadata...');

    // Send file metadata first (as a JSON string)
    const metadata = {
      type: 'file-metadata',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    };
    dataChannelRef.current.send(JSON.stringify(metadata));

    let offset = 0;
    fileReaderRef.current = new FileReader(); // Create a new FileReader instance for each transfer

    fileReaderRef.current.onload = (e) => {
      const chunk = e.target?.result as ArrayBuffer; 
      if (chunk) {
        dataChannelRef.current?.send(chunk); 
        offset += chunk.byteLength; 
        setTransferProgress((offset / file.size) * 100); // Update transfer progress
       
        if (offset < file.size) {
          readNextChunk(); // Read the next chunk if not all sent
        } else {
        
          dataChannelRef.current?.send(JSON.stringify({ type: 'file-end' }));
          setConnectionStatus('File sent successfully!');
          showInfoMessage('File sent successfully!');
          console.log('[Sender] All file chunks sent. Signalling completion to backend.');
          // Signal backend that transfer is completed
          socketRef.current?.emit('transfer-completed', { shareCode: currentShareCode });
          resetAllUIState(); // Reset after successful transfer
        }
      }
    };

    fileReaderRef.current.onerror = (error: any) => {
      console.error('[Sender] File reading error:', error);
      showInfoMessage(`Error reading file: ${error.message}`);
      setConnectionStatus('Error during transfer');
      resetAllUIState();
    };

    // Helper function to read the next slice of the file
    const readNextChunk = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      fileReaderRef.current?.readAsArrayBuffer(slice);
    };

    readNextChunk(); // Start the process by reading the first chunk
  }, [dataChannelRef, setConnectionStatus, setTransferProgress, showInfoMessage, resetAllUIState]);


  // --- Receiver Logic ---
  // Callback function passed to ReceiverBox to initiate receiving process
  const handleReceiverStartReceiving = useCallback(async (code: string) => {
    if (!code) {
      showInfoMessage('Please enter a share code.');
      return;
    }
    setEnteredCode(code); // Ensure enteredCode state is set
    setConnectionStatus('Looking for transfer...');
    console.log('[Receiver] Starting receive process...');

    // Initialize Socket.IO connection if not already connected
    if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = io(BACKEND_URL); // Connect to your Node.js backend
        socketRef.current.on('connect', () => console.log('[Socket.IO] Connected.'));
        socketRef.current.on('disconnect', () => console.log('[Socket.IO] Disconnected.'));
        socketRef.current.on('connect_error', (err) => {
          console.error('[Socket.IO] Connection error:', err);
          showInfoMessage(`Failed to connect to signaling server: ${err.message}`);
          resetAllUIState();
        });
    } else {
        console.log('[Socket.IO] Already connected.');
    }

    // Listen for offer and candidates from the backend first
    socketRef.current?.on('offer-received', async (data: { offer: any; shareCode: string; fileMetadata: FileMetadata }) => {
      console.log('[Receiver] Offer received from backend:', data);
      if (data.shareCode === code && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
        setConnectionStatus('Offer received. Connecting to sender...');
        await createPeerConnection(false, code); // Initialize WebRTC peer connection as receiver

        // FIX: Remove JSON.parse here, as Socket.IO already deserializes it
        const offer = new RTCSessionDescription(data.offer); // <-- CHANGE HERE
        await peerConnectionRef.current.setRemoteDescription(offer);
        console.log('[Receiver] Set remote description (offer).');

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        console.log('[Receiver] Created and set local description (answer).');
        socketRef.current?.emit('send-answer', {
          shareCode: code,
          answer: answer,
          receiverId: currentUserIdRef.current,
        });
        console.log('[Receiver] Emitted send-answer to signaling server.');

        // Set metadata for UI display
        setReceivedFileMetadata(data.fileMetadata);
      }
    });

    socketRef.current?.on('candidate-received', async (data: { shareCode: string; candidate: any; isSender: boolean }) => {
      console.log('[Receiver] Candidate received from backend:', data);
      // Add candidate if it's from the other peer (sender) and remote description is set
      if (data.shareCode === code && data.isSender && peerConnectionRef.current?.remoteDescription) {
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('[Receiver] Added ICE candidate.');
        } catch (e) {
          console.warn('[Receiver] Error adding ICE candidate:', e);
        }
      }
    });

    // Emit 'join-transfer' to backend to retrieve offer and existing candidates
    console.log('[Receiver] Emitting join-transfer event...');
    socketRef.current?.emit('join-transfer', {
      shareCode: code,
      receiverId: currentUserIdRef.current,
    }, async (response: { success: boolean; transfer?: any; message?: string }) => {
        console.log('[Receiver] Received response for join-transfer:', response);
        if (response.success && response.transfer) {
            setConnectionStatus('Joined transfer. Waiting for offer...');
            // If offer was already sent by sender before receiver joined, process it now
            if (response.transfer.offer && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
                setConnectionStatus('Offer retrieved. Connecting to sender...');
                await createPeerConnection(false, code); // Initialize WebRTC peer connection as receiver

                // This JSON.parse is CORRECT because the offer comes from the DB as a string
                const offer = new RTCSessionDescription(JSON.parse(response.transfer.offer));
                await peerConnectionRef.current.setRemoteDescription(offer);
                console.log('[Receiver] Retrieved and set remote description (offer) from DB.');

                const answer = await peerConnectionRef.current.createAnswer();
                await peerConnectionRef.current.setLocalDescription(answer);
                console.log('[Receiver] Created and set local description (answer) after DB offer.');
                socketRef.current?.emit('send-answer', {
                  shareCode: code,
                  answer: answer,
                  receiverId: currentUserIdRef.current,
                });
                console.log('[Receiver] Emitted send-answer after DB offer.');
            }

            // Set metadata for UI display
            if (response.transfer.fileMetadata) {
              setReceivedFileMetadata(response.transfer.fileMetadata);
            }
            // Add any existing candidates that were sent before receiver joined
            if (response.transfer.senderCandidates && peerConnectionRef.current) {
                console.log('[Receiver] Adding existing sender candidates from DB.');
                for (const candidateJson of response.transfer.senderCandidates) {
                    try {
                        const candidate = new RTCIceCandidate(candidateJson);
                        await peerConnectionRef.current.addIceCandidate(candidate);
                    } catch (e) {
                        console.warn('[Receiver] Error adding initial sender candidate:', e);
                    }
                }
            }
        } else {
            showInfoMessage(`Failed to join transfer: ${response.message || 'Unknown error'}`);
            setConnectionStatus('Error');
            resetAllUIState();
        }
    });

  }, [createPeerConnection, showInfoMessage, setConnectionStatus, resetAllUIState]);


  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full">
   

   
      <div className="w-full max-w-lg mx-auto">
        <StatusDisplay connectionStatus={connectionStatus} transferProgress={transferProgress} />
      </div>

   
      <div className="flex flex-col md:flex-row justify-center items-stretch gap-8 w-full max-w-5xl px-4">
    
        <SenderBox
          connectionStatus={connectionStatus}
          fileToShare={fileToShare}
          setFileToShare={setFileToShare}
          shareCode={shareCode}
          onStartSharing={handleSenderStartSharing}
          // showInfoMessage prop is no longer passed
        />

      
        <ReceiverBox
          connectionStatus={connectionStatus}
          enteredCode={enteredCode}
          setEnteredCode={setEnteredCode}
          receivedFileMetadata={receivedFileMetadata}
          onStartReceiving={handleReceiverStartReceiving}
          // showInfoMessage prop is no longer passed
        />
      </div>

    
      <button
        onClick={resetAllUIState}
        className="mt-8 px-8 py-3 rounded-full text-lg font-semibold bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        Reset All Connections
      </button>
    </div>
  );
}