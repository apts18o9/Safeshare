// components/ReceiverBox.tsx
'use client';

import React, { useState, useCallback } from 'react';

// Define the FileMetadata interface (can be moved to a shared types file if project grows)
interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

interface ReceiverBoxProps {
  connectionStatus: string; // Passed from parent for button disabling
  enteredCode: string; // Real entered code from parent
  setEnteredCode: (code: string) => void; // Callback to update entered code in parent
  receivedFileMetadata: FileMetadata | null; // Real metadata received from parent
  onStartReceiving: (code: string) => void; // Callback to initiate real receiving
}

/**
 * Component for the file receiving interface, now integrated with real file data
 * and callbacks for actual WebRTC signaling initiation.
 */
export default function ReceiverBox({
  connectionStatus,
  enteredCode,
  setEnteredCode,
  receivedFileMetadata, // Now directly used from props
  onStartReceiving,
}: ReceiverBoxProps) {

  // Handles changes in the share code input field
  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEnteredCode(event.target.value.toUpperCase()); // Update the entered code in the parent's state
  };

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full md:w-1/2 border border-teal-700 flex flex-col justify-between">
      <div>
        <h2 className="text-3xl font-bold text-teal-400 mb-6">Receive a File</h2>
        <input
          type="text"
          placeholder="Enter Share Code"
          value={enteredCode}
          onChange={handleCodeChange}
          className="w-full p-4 text-center text-2xl font-bold bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-6"
        />
        {receivedFileMetadata && ( // Display metadata if available
          <div className="mb-4 text-left p-2 bg-gray-700 rounded-md border border-gray-600">
            <p className="text-md text-gray-300">Incoming File Details:</p>
            <p className="text-lg font-semibold text-blue-300">Name: {receivedFileMetadata.name}</p>
            <p className="text-md text-gray-400">Size: {(receivedFileMetadata.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p className="text-md text-gray-400">Type: {receivedFileMetadata.type}</p>
          </div>
        )}
        <button
          onClick={() => onStartReceiving(enteredCode)} // Call parent's real start receiving function
        //   disabled={!enteredCode || connectionStatus.includes('Connecting') || connectionStatus.includes('Transferring') || connectionStatus.includes('Waiting')}
          className="w-full bg-gradient-to-r from-teal-600 to-green-700 hover:from-teal-700 hover:to-green-800 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Connect & Download
        </button>
      </div>
    </div>
  );
}