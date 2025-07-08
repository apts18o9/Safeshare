// components/SharePanel.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from 'socket.io-client'; // Import Socket.IO client library

// Import the components using relative paths from the SAME directory
import ReceiverBox from "./ReceiverBox";
import SenderBox from "./SenderBox"; // CORRECTED: Ensure this imports your SenderBox component
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

// --- File Transfer Chunk Size ---
const CHUNK_SIZE = 64 * 1024; // 64 Kilobytes

// Backend URL where your Node.js server is running
// IMPORTANT: Make sure this matches your backend server's port (e.g., 5000)
// If deployed, this should be the deployed backend URL.
// This uses process.env.NEXT_PUBLIC_BACKEND_URL from your .env.local file
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
  const socketListenersSetup = useRef<string | null>(null);
  // const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  // Function to display messages (now logs to console instead of showing modal)
  const showInfoMessage = useCallback((msg: string) => {
    console.log(`P2P Info: ${msg}`);
    // If you want a non-blocking UI notification (like a toast), you'd implement it here.
  }, []);

  // --- Sender Specific States ---
  const [fileToShare, setFileToShare] = useState<File | null>(null);
  const [shareCode, setShareCode] = useState<string>('');

  // --- Receiver Specific States ---
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [receivedFileMetadata, setReceivedFileMetadata] = useState<FileMetadata | null>(null);
  const [receivedChunks, setReceivedChunks] = useState<Blob[]>([]); // To accumulate file chunks
  const [currentReceivedBytes, setCurrentReceivedBytes] = useState(0); // To track total bytes received
  const [isJoining, setIsJoining] = useState(false); // State for UI disabling
  const isJoiningRef = useRef(false); // Ref for immediate, synchronous check


  // ********************************************************************
  // ***** CRITICAL: MOUNT/UNMOUNT LOGGING FOR DIAGNOSIS ****************
  // ********************************************************************
  useEffect(() => {
    console.log('[SharePanel] Component Mounted');
    return () => {
      console.log('[SharePanel] Component Unmounted');
      // IMPORTANT: If this unmount happens unexpectedly, it means state is lost.
      // We'll re-enable resetAllUIState() here later if confirmed.
    };
  }, []);
  // ********************************************************************
  // ********************************************************************

  console.log('[SharePanel] Component Rendered'); // NEW: Log on every render


  // --- Reset All Connections and UI State ---
  const resetAllUIState = useCallback(() => {
    console.log('[RESET] Initiating full UI and connection reset.');
    // Close any active WebRTC connections and data channels
    if (peerConnectionRef.current) {
      console.log('[RESET] Closing RTCPeerConnection...');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      console.log('[RESET] Closing RTCDataChannel...');
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (fileReaderRef.current) {
      console.log('[RESET] Aborting FileReader...');
      fileReaderRef.current.abort(); // Abort any ongoing file reading
      fileReaderRef.current = null;
    }
    if (socketRef.current) {
      console.log('[RESET] Disconnecting Socket.IO...');
      // Remove all Socket.IO listeners before disconnecting to prevent stale handlers
      socketRef.current.offAny(); // Removes all listeners for all events
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
    setIsJoining(false); // Reset isJoining state (for UI)
    isJoiningRef.current = false; // Reset ref state
    showInfoMessage('All connections and UI states reset.');
    console.log('[RESET] Reset complete.');
  }, [showInfoMessage]);


  // Function to read file chunks and send them over the DataChannel
  const sendFileChunks = useCallback((currentShareCode: string, file: File) => {
    if (!file || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      showInfoMessage('Data channel not ready or no file selected to send.');
      return;
    }
    console.log('[Sender] Starting file chunk sending. DataChannel state:', dataChannelRef.current.readyState);

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
      const chunk = e.target?.result as ArrayBuffer; // Get the ArrayBuffer chunk
      if (chunk) {
        dataChannelRef.current?.send(chunk); // Send the chunk over the DataChannel
        offset += chunk.byteLength; // Update the offset
        setTransferProgress((offset / file.size) * 100); // Update transfer progress
        // console.log(`[Sender] Sent chunk: ${offset}/${file.size} bytes`); // Too verbose, uncomment for deep debug

        if (offset < file.size) {
          readNextChunk(); // Read the next chunk if not all sent
        } else {
          // All chunks sent, send a final 'file-end' signal
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


  // --- Common Data Channel Handlers Setup ---
  // This function needs to be defined BEFORE createPeerConnection
  const setupDataChannelHandlers = useCallback((isSender: boolean, code: string) => {
    if (!dataChannelRef.current) {
      console.error('[WebRTC] Data channel is null when trying to set up handlers. Cannot attach events.');
      return; // Ensure dataChannelRef.current is valid
    }
    console.log(`[DataChannel Setup] Attaching handlers for channel state: ${dataChannelRef.current.readyState}`);

    dataChannelRef.current.onopen = () => {
      console.log('[DataChannel] Opened! Ready to send/receive data.');
      setConnectionStatus('Connected');
      // If sender, start sending once data channel is open AND a file is selected
      if (isSender && fileToShare) {
        sendFileChunks(code, fileToShare);
      }
    };

    dataChannelRef.current.onmessage = async (event) => {
      console.log('[DataChannel] Message received. Type:', typeof event.data, 'Size:', event.data.byteLength || event.data.length);
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
            console.log('[DataChannel] Receiver: Blob created:', blob, 'Size:', blob.size);

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
      setConnectionStatus('Disconnected'); // This will trigger resetAllUIState
      showInfoMessage('Data channel closed.');
      // resetAllUIState(); // Removed direct call here as setConnectionStatus handles it
    };

    dataChannelRef.current.onerror = (error: any) => {
      console.error('[DataChannel] Error:', error);
      showInfoMessage(`Data channel error: ${error.error.message}`);
      resetAllUIState();
    };
  }, [fileToShare, receivedChunks, receivedFileMetadata, setConnectionStatus, setTransferProgress, showInfoMessage, resetAllUIState]);


  // --- WebRTC Core Setup Logic (Common to both Sender and Receiver) ---
  // This function sets up the RTCPeerConnection and its common handlers.
  const createPeerConnection = useCallback((isSender: boolean, currentShareCode: string) => {
    console.log(`[WebRTC Setup] Creating new RTCPeerConnection (isSender: ${isSender}) for code: ${currentShareCode}`);
    // Ensure previous connections are closed before creating new ones
    if (peerConnectionRef.current) {
      console.log('[WebRTC Setup] Closing existing peer connection before creating new one.');
      peerConnectionRef.current.close();
    }
    if (dataChannelRef.current) {
      console.log('[WebRTC Setup] Closing existing data channel before creating new one.');
      dataChannelRef.current.close();
    }

    peerConnectionRef.current = new RTCPeerConnection(ICE_SERVERS);
    setConnectionStatus('Connecting...');
    setTransferProgress(0); // Reset progress for new connection

    // --- ICE Candidate Handling ---
    // When the browser finds an ICE candidate (network path), send it to the other peer via the signaling server.
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        // Explicitly type candidate here
        const candidate: RTCIceCandidateInit = event.candidate.toJSON();
        // Emit ICE candidate to the signaling server via Socket.IO
        socketRef.current?.emit('send-candidate', {
          shareCode: currentShareCode,
          candidate: candidate, // Use the typed candidate
          isSender: isSender,
        });
        console.log(`[WebRTC] Emitted ICE candidate (${isSender ? 'sender' : 'receiver'}) for code: ${currentShareCode}: ${event.candidate.type}`);
      } else {
        console.log(`[WebRTC] ICE gathering complete for ${isSender ? 'sender' : 'receiver'}.`);
      }
    };

    // --- Peer Connection State Change ---
    // Monitor the overall state of the WebRTC peer connection.
    peerConnectionRef.current.onconnectionstatechange = () => {
      const state = peerConnectionRef.current?.connectionState || 'Unknown';
      console.log(`[WebRTC] Peer Connection State Changed: ${state}`); // More specific log
      setConnectionStatus(state);
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        console.error(`[WebRTC] Peer Connection ${state}! Triggering reset.`); // Added error log
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
      setupDataChannelHandlers(true, currentShareCode); // Sender sets up handlers immediately
    } else {
      // If this peer is the receiver, listen for the DataChannel being created by the sender.
      peerConnectionRef.current.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;
        console.log('[WebRTC] Receiver: Data channel received from remote peer.');
        setupDataChannelHandlers(false, currentShareCode); // Receiver sets up handlers once channel is received
      };
    }

  }, [showInfoMessage, resetAllUIState, setupDataChannelHandlers]);


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
        console.log('[Sender] WebRTC peer connection created. Current state:', peerConnectionRef.current?.connectionState);

        // Create and send WebRTC Offer
        console.log('[Sender] Creating WebRTC offer...');
        try {
          const offer = await peerConnectionRef.current?.createOffer();
          console.log('[Sender] Setting local description (offer)...');
          await peerConnectionRef.current?.setLocalDescription(offer);
          console.log('[Sender] Local description set. Current state:', peerConnectionRef.current?.localDescription?.type);
          console.log('[Sender] Emitting send-offer to signaling server...');
          socketRef.current?.emit('send-offer', {
            shareCode: generatedCode,
            offer: offer,
            senderId: currentUserIdRef.current,
          });
        } catch (error: any) {
          console.error('[Sender] Error during offer creation/setting local description:', error);
          showInfoMessage(`Error setting up sender offer: ${error.message}`);
          resetAllUIState();
          return;
        }


        // Listen for answer and candidates from the backend
        socketRef.current?.on('answer-received', async (data: { shareCode: string; answer: any }) => {
          console.log('[Sender] Answer received from backend:', data);
          if (data.shareCode === generatedCode && peerConnectionRef.current && !peerConnectionRef.current.currentRemoteDescription) {
            try {
              const answer = new RTCSessionDescription(data.answer);
              await peerConnectionRef.current.setRemoteDescription(answer);
              console.log('[Sender] Remote description (answer) set. Current state:', peerConnectionRef.current?.remoteDescription?.type);
              setConnectionStatus('Recipient connected. Transferring...');
              showInfoMessage('Recipient connected. Starting transfer!');
            } catch (error: any) {
              console.error('[Sender] Error setting remote description (answer):', error);
              showInfoMessage(`Error setting up sender answer: ${error.message}`);
              resetAllUIState();
            }
          }
        });

        socketRef.current?.on('candidate-received', async (data: { shareCode: string; candidate: any; isSender: boolean }) => {
          console.log('[Sender] Candidate received from backend:', data);
          // Add candidate if it's from the other peer (receiver) and remote description is set
          if (data.shareCode === generatedCode && !data.isSender && peerConnectionRef.current?.remoteDescription) {
            try {
              // Explicitly type candidate here
              const candidate: RTCIceCandidateInit = data.candidate;
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


  // --- Receiver Logic (Actual implementation) ---
  // Key fixes for your receiver logic:

  const handleReceiverStartReceiving = useCallback(async (code: string) => {
    console.log(`[Receiver] isJoiningRef.current at start: ${isJoiningRef.current}`);

    if (!code) {
      showInfoMessage('Please enter a share code.');
      return;
    }

    // ENHANCED: More robust duplicate prevention
    if (isJoiningRef.current) {
      console.log('[Receiver] Already attempting to join (via ref). Ignoring duplicate call.');
      return;
    }

    // ENHANCED: Check if already connected to this code
    if (enteredCode === code && peerConnectionRef.current &&
      (peerConnectionRef.current.connectionState === 'connected' ||
        peerConnectionRef.current.connectionState === 'connecting')) {
      console.log('[Receiver] Already connected/connecting to this code. Ignoring.');
      return;
    }

    // Set guards immediately and synchronously
    setIsJoining(true);
    isJoiningRef.current = true;
    setEnteredCode(code);
    setConnectionStatus('Looking for transfer...');
    console.log('[Receiver] Starting receive process...');

    try {
      // Initialize Socket.IO connection if not already connected
      if (!socketRef.current || !socketRef.current.connected) {
        socketRef.current = io(BACKEND_URL);

        // ENHANCED: Add timeout for connection
        const connectionTimeout = setTimeout(() => {
          console.error('[Socket.IO] Connection timeout');
          showInfoMessage('Connection to server timed out');
          resetReceiver();
        }, 10000);

        socketRef.current.on('connect', () => {
          console.log('[Socket.IO] Connected.');
          clearTimeout(connectionTimeout);
        });

        socketRef.current.on('disconnect', () => {
          console.log('[Socket.IO] Disconnected.');
          resetReceiver();
        });

        socketRef.current.on('connect_error', (err) => {
          console.error('[Socket.IO] Connection error:', err);
          showInfoMessage(`Failed to connect to signaling server: ${err.message}`);
          resetReceiver();
          clearTimeout(connectionTimeout);
        });
      }

      // ENHANCED: Better peer connection management
      console.log('[Receiver] Creating WebRTC peer connection immediately...');

      // Clean up existing connection if any
      if (peerConnectionRef.current) {
        console.log('[Receiver] Cleaning up existing peer connection');
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      await createPeerConnection(false, code);

      // ENHANCED: Set up event listeners only once per code
      if (!socketListenersSetup.current || socketListenersSetup.current !== code) {
        console.log('[Receiver] Setting up socket listeners for code:', code);

        // Clean up old listeners
        socketRef.current?.removeAllListeners('offer-received');
        socketRef.current?.removeAllListeners('candidate-received');

        socketRef.current?.on('offer-received', async (data: { offer: any; shareCode: string; fileMetadata: FileMetadata }) => {
          console.log('[Receiver] Offer received from backend:', data);

          // ENHANCED: More robust offer processing
          if (data.shareCode === code && peerConnectionRef.current &&
            !peerConnectionRef.current.currentRemoteDescription &&
            isJoiningRef.current) {

            await processOffer(data.offer, data.fileMetadata, code, 'socket');
          }
        });

        socketRef.current?.on('candidate-received', async (data: { shareCode: string; candidate: any; isSender: boolean }) => {
          console.log('[Receiver] Candidate received from backend:', data);

          if (data.shareCode === code && data.isSender &&
            peerConnectionRef.current?.remoteDescription &&
            isJoiningRef.current) {

            try {
              const candidate: RTCIceCandidateInit = data.candidate;
              await peerConnectionRef.current.addIceCandidate(candidate);
            } catch (e) {
              console.warn('[Receiver] Error adding ICE candidate:', e);
            }
          }
        });

        socketListenersSetup.current = code;
      }

      // ENHANCED: Single join attempt with better error handling
      console.log('[Receiver] Emitting join-transfer event...');

      // Use Promise wrapper for better timeout handling
      const joinTransferPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Join transfer timeout'));
        }, 15000);

        socketRef.current?.emit('join-transfer', {
          shareCode: code,
          receiverId: currentUserIdRef.current,
        }, (response: { success: boolean; transfer?: any; message?: string }) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      const response = await joinTransferPromise as { success: boolean; transfer?: any; message?: string };

      console.log('[Receiver] Received response for join-transfer:', response);

      if (response.success && response.transfer) {
        console.log('[Receiver] Full transfer object from backend:', response.transfer);
        setConnectionStatus('Joined transfer. Processing offer...');

        // Process existing offer if available

        // const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
        if (response.transfer.offer && peerConnectionRef.current &&
          !(peerConnectionRef.current as RTCPeerConnection).currentRemoteDescription) {

          const offer = new RTCSessionDescription(JSON.parse(response.transfer.offer));
          await processOffer(offer, response.transfer.fileMetadata, code, 'database');
        }

        // Set metadata
        if (response.transfer.fileMetadata) {
          setReceivedFileMetadata(response.transfer.fileMetadata);
        }

        // Add existing sender candidates
        if (response.transfer.senderCandidates && peerConnectionRef.current) {
          console.log('[Receiver] Adding existing sender candidates from DB.');
          for (const candidateJson of response.transfer.senderCandidates) {
            try {
              const candidate: RTCIceCandidateInit = candidateJson;
              await (peerConnectionRef.current as RTCPeerConnection).addIceCandidate(candidate);
            } catch (e) {
              console.warn('[Receiver] Error adding initial sender candidate:', e);
            }
          }
        }
      } else {
        throw new Error(response.message || 'Unknown error joining transfer');
      }

    } catch (error: any) {
      console.error('[Receiver] Error in handleReceiverStartReceiving:', error);
      showInfoMessage(`Failed to join transfer: ${error.message}`);
      resetReceiver();
    }
  }, [createPeerConnection, showInfoMessage, setConnectionStatus, resetAllUIState]);

  // ENHANCED: Helper function to process offers (reduces code duplication)
  const processOffer = async (offer: RTCSessionDescription, fileMetadata: FileMetadata, code: string, source: string) => {
    try {
      console.log(`[Receiver] Processing offer from ${source}...`);
      setConnectionStatus('Offer received. Connecting to sender...');

      await peerConnectionRef.current?.setRemoteDescription(offer);
      console.log(`[Receiver] Set remote description from ${source} successful`);

      const answer = await peerConnectionRef.current?.createAnswer();
      await peerConnectionRef.current?.setLocalDescription(answer);
      console.log(`[Receiver] Created and set local description (answer) from ${source}`);

      socketRef.current?.emit('send-answer', {
        shareCode: code,
        answer: answer,
        receiverId: currentUserIdRef.current,
      });
      console.log(`[Receiver] Emitted send-answer from ${source} processing`);

      if (fileMetadata) {
        setReceivedFileMetadata(fileMetadata);
      }

    } catch (error: any) {
      console.error(`[Receiver] Error processing offer from ${source}:`, error);
      showInfoMessage(`Error setting up connection from ${source}: ${error.message}`);
      resetReceiver();
    }
  };

  // ENHANCED: Better cleanup function
  const resetReceiver = () => {
    console.log('[Receiver] Resetting receiver state');
    setIsJoining(false);
    isJoiningRef.current = false;
    socketListenersSetup.current = null;
    resetAllUIState();
  };

  // ENHANCED: Add these refs at the top of your component
  // const socketListenersSetup = useRef<string | null>(null);

  // ENHANCED: Add cleanup on unmount
  useEffect(() => {
    return () => {
      resetReceiver();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ENHANCED: Add this check in your UI to prevent multiple clicks
  const handleJoinClick = (code: string) => {
    if (isJoiningRef.current) {
      console.log('[UI] Already joining, ignoring click');
      return;
    }
    handleReceiverStartReceiving(code);
  };

  //
  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full">
      {/* Custom Modal is removed, so no rendering here */}

      {/* Connection Status and Progress Bar (Common for both) */}
      <div className="w-full max-w-lg mx-auto">
        <StatusDisplay connectionStatus={connectionStatus} transferProgress={transferProgress} />
      </div>

      {/* Sender and Receiver Boxes (Side-by-Side on larger screens, stacked on small) */}
      <div className="flex flex-col md:flex-row justify-center items-stretch gap-8 w-full max-w-5xl px-4">
        {/* Sender Box */}
        <SenderBox
          connectionStatus={connectionStatus}
          fileToShare={fileToShare}
          setFileToShare={setFileToShare}
          shareCode={shareCode}
          onStartSharing={handleSenderStartSharing}
        // showInfoMessage prop is no longer passed
        />

        {/* Receiver Box */}
        <ReceiverBox
          connectionStatus={connectionStatus}
          enteredCode={enteredCode}
          setEnteredCode={setEnteredCode}
          receivedFileMetadata={receivedFileMetadata}
          onStartReceiving={handleReceiverStartReceiving} // Pass the actual handler
          isJoining={isJoining} // Pass isJoining prop (from useState)
        />
      </div>

      {/* A common reset button */}
      <button
        onClick={resetAllUIState}
        className="mt-8 px-8 py-3 rounded-full text-lg font-semibold bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        Reset All Connections
      </button>
    </div>
  );
}