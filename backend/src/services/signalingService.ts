// backend/src/services/signalingService.ts
// This file contains the Socket.IO event handling logic for WebRTC signaling.

import { Server as SocketIOServer, Socket } from 'socket.io'; // Import Socket.IO server and socket types
import Transfer from '../models/Transfer'; // Mongoose Transfer model
import { nanoid } from 'nanoid'; // For generating unique IDs

// Define a type for the Socket.IO server instance to improve type safety
type IoInstance = SocketIOServer;

/**
 * Initializes Socket.IO signaling handlers.
 * @param io The Socket.IO server instance.
 */
const initSignalingService = (io: IoInstance) => {
  io.on('connection', (socket: Socket) => {
    console.log(`[Backend Socket] Connected: ${socket.id}`);

    // --- Sender Side Events ---

    /**
     * Handles 'create-transfer' event from the sender.
     * Generates a unique share code (now 6 digits) and creates an initial transfer document in MongoDB.
     * Emits 'transfer-created' back to the sender with the share code.
     */
    socket.on('create-transfer', async (data: { fileMetadata: any; senderId: string }, callback: (response: { success: boolean; shareCode?: string; message?: string }) => void) => {
      console.log(`[Backend Socket: create-transfer] Event received from ${socket.id}`);
      console.log(`[Backend Socket: create-transfer] Data received:`, data);

      // FIX: Changed nanoid(8) to nanoid(6) for a 6-digit code
      let shareCode = nanoid(6).toUpperCase(); // Generate a 6-character unique code
      let isUnique = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 5;

      // Loop to ensure unique share code
      while (!isUnique && attempts < MAX_ATTEMPTS) {
        console.log(`[Backend Socket: create-transfer] Attempting to generate unique code (Attempt ${attempts + 1})...`);
        const existingTransfer = await Transfer.findOne({ shareCode });
        if (!existingTransfer) {
          isUnique = true;
          console.log(`[Backend Socket: create-transfer] Unique share code generated: ${shareCode}`);
        } else {
          shareCode = nanoid(6).toUpperCase(); // Regenerate if not unique
          attempts++;
        }
      }

      if (!isUnique) {
        console.error(`[Backend Socket: create-transfer] Failed to generate unique share code after ${MAX_ATTEMPTS} attempts.`);
        return callback({ success: false, message: 'Failed to generate unique share code.' });
      }

      try {
        console.log(`[Backend Socket: create-transfer] Creating new Transfer document...`);
        // Create a new transfer document in MongoDB
        const newTransfer = new Transfer({
          shareCode,
          senderId: data.senderId,
          fileMetadata: data.fileMetadata,
          status: 'pending',
        });
        console.log(`[Backend Socket: create-transfer] Saving new Transfer document to MongoDB...`);
        await newTransfer.save(); // Save the new transfer
        console.log(`[Backend Socket: create-transfer] Transfer saved successfully!`);

        console.log(`[Backend Socket: create-transfer] Transfer created with code: ${shareCode} by sender ${data.senderId}`);
        // Send success response back to the sender
        callback({ success: true, shareCode });
        console.log(`[Backend Socket: create-transfer] Callback sent to frontend with success.`);
      } catch (error: any) {
        // Log any errors during connection and exit the process
        console.error(`[Backend Socket: create-transfer] Error caught during transfer creation/save: ${error.message}`);
        console.error(error); // Log full error object for more details
        callback({ success: false, message: `Failed to create transfer: ${error.message}` });
        console.log(`[Backend Socket: create-transfer] Callback sent to frontend with error.`);
      }
    });

    /**
     * Handles 'send-offer' event from the sender.
     * Updates the transfer document with the sender's SDP offer.
     * Emits 'offer-received' to any receiver waiting for this code.
     */
    socket.on('send-offer', async (data: { shareCode: string; offer: any; senderId: string }) => {
      console.log(`[Backend Socket: send-offer] Event received for code: ${data.shareCode}`);
      try {
        const transfer = await Transfer.findOneAndUpdate(
          { shareCode: data.shareCode, senderId: data.senderId, status: 'pending' },
          { offer: JSON.stringify(data.offer), status: 'connecting' }, // Store offer as string
          { new: true }
        );

        if (transfer) {
          console.log(`[Backend Socket: send-offer] Offer updated for code: ${data.shareCode}`);
          // Emit to a specific room based on shareCode
          io.to(data.shareCode).emit('offer-received', { offer: data.offer, shareCode: data.shareCode, fileMetadata: transfer.fileMetadata });
          console.log(`[Backend Socket: send-offer] Emitted 'offer-received' to room ${data.shareCode}`);
        } else {
          console.warn(`[Backend Socket: send-offer] Transfer not found or already processed for offer: ${data.shareCode}`);
        }
      } catch (error: any) {
        console.error(`[Backend Socket: send-offer] Error processing offer: ${error.message}`);
        console.error(error);
      }
    });

    /**
     * Handles 'send-candidate' event for ICE candidates.
     * Adds the candidate to the respective sender/receiver candidate array in MongoDB.
     * Emits 'candidate-received' to the other peer in the same transfer.
     */
    socket.on('send-candidate', async (data: { shareCode: string; candidate: any; isSender: boolean }) => {
      // console.log(`[Backend Socket: send-candidate] Event received for code: ${data.shareCode} (isSender: ${data.isSender})`); // Too verbose
      try {
        const updateField = data.isSender ? 'senderCandidates' : 'receiverCandidates';
        const transfer = await Transfer.findOneAndUpdate(
          { shareCode: data.shareCode },
          { $push: { [updateField]: data.candidate } }, // Push candidate to the array
          { new: true }
        );

        if (transfer) {
          // Emit the candidate to the other peer in the same room (shareCode)
          socket.to(data.shareCode).emit('candidate-received', { candidate: data.candidate, isSender: data.isSender });
          // console.log(`[Backend Socket: send-candidate] Candidate ${data.isSender ? 'from sender' : 'from receiver'} for code ${data.shareCode} forwarded.`); // Too verbose
        } else {
          console.warn(`[Backend Socket: send-candidate] Transfer not found for candidate: ${data.shareCode}`);
        }
      } catch (error: any) {
        console.error(`[Backend Socket: send-candidate] Error processing candidate: ${error.message}`);
        console.error(error);
      }
    });

    // --- Receiver Side Events ---

    /**
     * Handles 'join-transfer' event from the receiver.
     * Receiver joins a Socket.IO room based on the share code.
     * Retrieves the offer and existing candidates from MongoDB and sends them to the receiver.
     */
    socket.on('join-transfer', async (data: { shareCode: string; receiverId: string }, callback: (response: { success: boolean; transfer?: any; message?: string }) => void) => {
      console.log(`[Backend Socket: join-transfer] Event received from ${socket.id} for code: ${data.shareCode}`);
      socket.join(data.shareCode); // Join the Socket.IO room
      console.log(`[Backend Socket: join-transfer] Socket ${socket.id} joined room ${data.shareCode} as receiver ${data.receiverId}`);

      try {
        console.log(`[Backend Socket: join-transfer] Searching for transfer with code: ${data.shareCode}`);
        const transfer = await Transfer.findOneAndUpdate(
          { shareCode: data.shareCode, status: 'connecting' }, // Find transfer in connecting state
          { receiverId: data.receiverId, status: 'active' }, // Set receiver ID and status to active
          { new: true }
        );

        if (transfer) {
          console.log(`[Backend Socket: join-transfer] Transfer found and updated for code: ${data.shareCode}`);
          callback({ success: true, transfer: {
            shareCode: transfer.shareCode,
            offer: transfer.offer ? JSON.parse(transfer.offer) : null, // Parse offer if it exists
            fileMetadata: transfer.fileMetadata,
            senderCandidates: transfer.senderCandidates,
            receiverCandidates: transfer.receiverCandidates // Send existing candidates to new receiver
          }});
          console.log(`[Backend Socket: join-transfer] Callback sent to frontend with transfer data.`);
          // Notify sender that a receiver has joined and get ready to send offer
          io.to(transfer.shareCode).emit('receiver-joined', { shareCode: transfer.shareCode });
          console.log(`[Backend Socket: join-transfer] Emitted 'receiver-joined' to room ${transfer.shareCode}`);
        } else {
          console.warn(`[Backend Socket: join-transfer] Transfer not found or not in 'connecting' status for code: ${data.shareCode}`);
          callback({ success: false, message: 'Transfer not found or offer not ready.' });
          socket.leave(data.shareCode); // Leave room if transfer not found/ready
          console.log(`[Backend Socket: join-transfer] Callback sent to frontend with error (transfer not found).`);
        }
      } catch (error: any) {
        console.error(`[Backend Socket: join-transfer] Error caught during join transfer: ${error.message}`);
        console.error(error);
        callback({ success: false, message: `Failed to join transfer: ${error.message}` });
        console.log(`[Backend Socket: join-transfer] Callback sent to frontend with error.`);
      }
    });

    /**
     * Handles 'send-answer' event from the receiver.
     * Updates the transfer document with the receiver's SDP answer.
     * Emits 'answer-received' back to the sender.
     */
    socket.on('send-answer', async (data: { shareCode: string; answer: any; receiverId: string }) => {
      console.log(`[Backend Socket: send-answer] Event received for code: ${data.shareCode}`);
      try {
        const transfer = await Transfer.findOneAndUpdate(
          { shareCode: data.shareCode, receiverId: data.receiverId, status: 'active' },
          { answer: JSON.stringify(data.answer) }, // Store answer as string
          { new: true }
        );

        if (transfer) {
          console.log(`[Backend Socket: send-answer] Answer updated for code: ${data.shareCode}`);
          // Emit the answer to the sender (who is also in the shareCode room)
          io.to(data.shareCode).emit('answer-received', { answer: data.answer, shareCode: data.shareCode });
          console.log(`[Backend Socket: send-answer] Emitted 'answer-received' to room ${data.shareCode}`);
        } else {
          console.warn(`[Backend Socket: send-answer] Transfer not found or status not active for answer: ${data.shareCode}`);
        }
      } catch (error: any) {
        console.error(`[Backend Socket: send-answer] Error processing answer: ${error.message}`);
        console.error(error);
      }
    });

    /**
     * Handles 'transfer-completed' event.
     * Updates the status of the transfer to 'completed' in MongoDB.
     */
    socket.on('transfer-completed', async (data: { shareCode: string }) => {
      console.log(`[Backend Socket: transfer-completed] Event received for code: ${data.shareCode}`);
      try {
        await Transfer.findOneAndUpdate({ shareCode: data.shareCode }, { status: 'completed' });
        console.log(`[Backend Socket: transfer-completed] Transfer ${data.shareCode} marked as completed.`);
        // Optionally, notify the other peer if they are still connected
        socket.to(data.shareCode).emit('transfer-finalized', { shareCode: data.shareCode, status: 'completed' });
        // After completion, all sockets in this room can leave
        io.in(data.shareCode).socketsLeave(data.shareCode);
        console.log(`[Backend Socket: transfer-completed] Sockets left room ${data.shareCode}`);
      } catch (error: any) {
        console.error(`[Backend Socket: transfer-completed] Error marking transfer completed: ${error.message}`);
        console.error(error);
      }
    });

    // --- Disconnection Handling ---
    socket.on('disconnect', () => {
      console.log(`[Backend Socket] Disconnected: ${socket.id}`);
      // Consider logic to clean up transfers if a sender/receiver disconnects prematurely.
      // This can be complex, often handled by a separate cleanup service or heartbeat.
    });
  });
};

export default initSignalingService;