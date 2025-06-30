'use client'
import { clear } from "console";
import { useState, useCallback } from "react"


interface ReceiverBoxProps {
    connectionStatus: string,
    setConnectionStatus: (status: string) => void,
    setTansferProgres: (progress: number) => void,
    showInfoMessage: (message: string) => void,
    resetAllUIState: () => void;
}



export default function ReceiverBox({
    connectionStatus,
    setConnectionStatus,
    setTansferProgres,
    showInfoMessage,
    resetAllUIState,
}: ReceiverBoxProps) {
    const [incomingFileName, setIncomingFileName] = useState<string | null>(null);
    const [incomingFileSize, setIncomingFileSize] = useState<string | null>(null);
    const [enteredCodeDisplay, setEntertedCodeDisplay] = useState<string>('');

    //receiver UI part
    const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEntertedCodeDisplay(event.target.value.toUpperCase());
        setIncomingFileName(null)
        setIncomingFileSize(null)
        setConnectionStatus('Ready to receive')
        setTansferProgres(0);
    }

    const startReceivingUI = useCallback(() => {
        if (!enteredCodeDisplay) {
            showInfoMessage('Please enter the code to start receiving.');
            return;
        }

        setConnectionStatus('Connecting..')
        setTansferProgres(0);

        setTimeout(() => {
            setIncomingFileName('text.pdf')
            setIncomingFileName('10.5mb')
            showInfoMessage(`Found file details for code: ${enteredCodeDisplay}`)
            setConnectionStatus('Receiving.')

            let progress = 0;
            const interval = setInterval(() => {
                progress += 15
                if (progress <= 100) {
                    setTansferProgres(progress)
                    if (progress === 100) {
                        clearInterval(interval)
                        setConnectionStatus('Download Complete')
                        showInfoMessage('File Download')
                        setEntertedCodeDisplay('')
                        setIncomingFileName(null)
                        setIncomingFileSize(null)
                    }
                }
            }, 200)
        }, 1500)

    }, [enteredCodeDisplay, setConnectionStatus, setTansferProgres, showInfoMessage])



    return (
        <div className="bg-[#52525c] rounded-xl shadow-xl border border-teal-700 flex flex-col w-80 h-55  p-4">
            <div>
                <h2 className="text-xl font-bold text-[#05df72] mb-4 text-center">Receive a File</h2>
                <input
                    type="text"
                    placeholder="Enter Code"
                    value={enteredCodeDisplay}
                    onChange={handleCodeChange}
                    className="w-full p-2 text-center text-base font-bold bg-[#171717] border rounded mb-4 text-white placeholder-white "
                />
                {incomingFileName && (
                    <div className="mb-2 w-full text-left">
                        <p className="text-sm text-gray-300">Incoming File Details:</p>
                        <p className="text-base font-semibold text-blue-300">Name: {incomingFileName}</p>
                        <p className="text-base text-blue-300">: {incomingFileSize}</p>
                    </div>
                )}
                <button type="button"
                    onClick={startReceivingUI}
                    className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700">
                    Download File
                </button>
            </div>
        </div>
    )
}
