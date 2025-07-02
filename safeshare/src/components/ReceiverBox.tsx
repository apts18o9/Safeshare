'use client'
import { clear } from "console";
import { useState, useCallback } from "react"

interface FileMetadata {
    name: string,
    type: string,
    size: number
}


interface ReceiverBoxProps {
    connectionStatus: string,
    enteredCode: string,
    setEnteredCode: (code: string) => void,
    receivedFileMetadata: FileMetadata | null,
    onStartReceiving: (message: string) => void
}



export default function ReceiverBox({
    connectionStatus,
    enteredCode,
    setEnteredCode,
    receivedFileMetadata,
    onStartReceiving,
}: ReceiverBoxProps) {


    const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEnteredCode(event.target.value.toUpperCase()); 
    };



    return (
        <div className="bg-[#52525c] rounded-xl shadow-xl border border-teal-700 flex flex-col w-80 h-55  p-4">
            <div>
                <h2 className="text-xl font-bold text-[#05df72] mb-4 text-center">Receive a File</h2>
                <input
                    type="text"
                    placeholder="Enter Code"
                    value={enteredCode}
                    onChange={handleCodeChange}
                    className="w-full p-2 text-center text-base font-bold bg-[#171717] border rounded mb-4 text-white placeholder-white "
                />
                {receivedFileMetadata && (
                    <div className="mb-2 w-full text-left">
                        <p className="text-sm text-gray-300">Incoming File Details:</p>
                        <p className="text-base font-semibold text-blue-300">Name: {receivedFileMetadata.name}</p>
                        <p className="text-base text-blue-400">Size: {(receivedFileMetadata.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                )}
                <button type="button"
                    onClick={()=> onStartReceiving(enteredCode)}
                    disabled={!enteredCode || connectionStatus.includes('Connecting') || connectionStatus.includes('Waiting')}
                    className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700">
                    Connect and download file
                </button>
            </div>
        </div>
    )
}
