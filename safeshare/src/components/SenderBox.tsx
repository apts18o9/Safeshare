// components/SenderBox.tsx
'use client';

import React, { useState, useCallback } from 'react';

interface SenderBoxProps {
    connectionStatus: string,
    setConnectionStatus: (status: string) => void,
    setTransferProgres: (progress: number) => void,
    showInfoMessage: (message: string) => void,
    resetAllUIState: () => void
}

//file transfering component 

export default function SenderBox({
    connectionStatus,
    setConnectionStatus,
    setTransferProgres,
    showInfoMessage,
    resetAllUIState,
}: SenderBoxProps) {

    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [shareCodeDisplay, setShareCodeDisplay] = useState<string>('');

    //UI handling for frontend 

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            setSelectedFileName(file.name);
            setShareCodeDisplay(''); //null on selecting new file
            setConnectionStatus('Ready to send');
            setTransferProgres(0);
            showInfoMessage(`File Selected: ${file.name}`)
        }
        else {
            setSelectedFileName(null)
            setShareCodeDisplay('')
            setConnectionStatus('Disconnected')
            setTransferProgres(0)
            showInfoMessage('No file selected')
        }
    };



    const startSharingUI = useCallback(() => {
        if (!selectedFileName) {
            showInfoMessage('Please select a flie to start sharing');
            return;
        }
        const simulateCode = 'START-SHARING' //placeholder
        setShareCodeDisplay(simulateCode)
        setConnectionStatus('Starting: Waiting for recipient..')
        setTransferProgres(0)
        showInfoMessage(`Transfer share code is: ${simulateCode}`)



        //tranfer progress bar

        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            if (progress <= 100) {
                setTransferProgres(progress)

                if (progress === 100) {
                    clearInterval(interval)
                    setConnectionStatus('File sent successfully!')
                    showInfoMessage('File sent!')
                    setShareCodeDisplay('')
                    setSelectedFileName(null)
                }
            }
        }, 300);
    }, [selectedFileName, setConnectionStatus, setTransferProgres, showInfoMessage]);




    return (
        <div className="bg-[#52525c] rounded-xl shadow-xl border border-teal-700 flex flex-col w-80 h-56 p-4">
            <div>
                <h2 className="text-xl font-bold text-[#05df72] mb-4 text-center">Send a File</h2>
                <input
                    type="file"
                    className="block w-full text-sm text-gray-300
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-gray-200 file:text-gray-700
                    hover:file:bg-gray-300
                    mb-6 cursor-pointer"
                    onChange={handleFileChange}

                />
                {selectedFileName && (
                    <p className="text-md text-gray-300 mb-4">
                        Selected: <span className="font-semibold text-blue-300">{selectedFileName}</span> (Simulated Size)
                    </p>
                )}
                <button
                    onClick={startSharingUI}
                    disabled={!selectedFileName || connectionStatus.includes('Simulating')}
                    className="w-full bg-blue-600 text-white p-2text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                    {shareCodeDisplay ? `Simulate Resend Code (Code: ${shareCodeDisplay})` : 'Generate code and send'}
                </button>
            </div>
            {shareCodeDisplay && (
                <div>
                    <p className='text-gray-400 mb-2'>Share this code: </p>
                    <code className='text-transparent bg-clip-text'>
                        {shareCodeDisplay}
                    </code>
                    <button
                        onClick={()=> {
                            navigator.clipboard.writeText(shareCodeDisplay);
                            showInfoMessage('Transfer code copied to clipboard')
                        }}
                        className='mt-1 px-3 py-2 bg-gray-400'
                    >
                        Copy Code
                    </button>
                    <p className="text-gray-400 mt-2 text-sm text-center">Your file will be sent once the recipient enters this code.</p>
                </div>
            )}


        </div>
    );
}
