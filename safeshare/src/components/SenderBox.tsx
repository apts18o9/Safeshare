// components/SenderBox.tsx
'use client';

import React, { useState, useCallback } from 'react';

interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

interface SenderBoxProps {
  connectionStatus: string; // Passed from parent for button disabling
  fileToShare: File | null; // Actual File object selected by user
  setFileToShare: (file: File | null) => void; // Callback to update file in parent
  shareCode: string; // Real share code from parent
  onStartSharing: (file: File) => void; // Callback to initiate real sharing
  
}


export default function SenderBox({
  connectionStatus,
  fileToShare, 
  setFileToShare, 
  shareCode,
  onStartSharing,
 
}: SenderBoxProps) {

  // Handles file selection from the input element
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setFileToShare(file); 
      console.log(`File Selected: ${file.name}`);
      
     
    } else {
      setFileToShare(null);
      console.log('no file selected');
      
      
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full md:w-1/2 border border-purple-700 flex flex-col justify-between">
      <div>
        <h2 className="text-3xl font-bold text-purple-400 mb-6">Send a File</h2>
        <input
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 mb-6 cursor-pointer"
        />
        {/* Display selected file name and size directly in the box */}
        {fileToShare ? (
          <p className="text-md text-gray-300 mb-4">
            Selected: <span className="font-semibold text-blue-300">{fileToShare.name}</span> ({(fileToShare.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        ) : (
          <p className="text-md text-gray-400 mb-4">No file selected.</p>
        )}
        <button
          onClick={() => fileToShare && onStartSharing(fileToShare)} // Call parent's real start sharing function
          disabled={!fileToShare || connectionStatus.includes('Connecting') || connectionStatus.includes('Transferring') || connectionStatus.includes('Waiting')}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-700 hover:from-purple-700 hover:to-pink-800 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {shareCode ? `Resend (Code: ${shareCode})` : 'Generate Share Code & Send'}
        </button>
      </div>
      {shareCode && (
        <div className="mt-8 p-4 bg-gray-700 rounded-lg flex flex-col items-center border border-pink-600">
          <p className="text-xl text-gray-300 mb-2">Share this code:</p>
          <code className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 my-4 select-all break-all">
            {shareCode}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareCode);
              console.log('Share code copied to clipboard!'); // CustomModal still used here
            }}
            className="mt-4 px-6 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-full shadow-md hover:scale-105 transition-transform"
          >
            Copy Code
          </button>
          <p className="text-gray-400 mt-2 text-sm text-center">Your file will be sent once the recipient enters this code.</p>
        </div>
      )}
    </div>
  );
}