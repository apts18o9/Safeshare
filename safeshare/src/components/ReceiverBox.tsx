'use client'
import { useState } from "react"

export default function ReceiverBox() {
    const [incomingFileName, setIncomingFileName] = useState('')

    return (
        <div className="bg-[#52525c] rounded-xl shadow-xl border border-teal-700 flex flex-col w-80 h-55  p-4">
            <h2 className="text-xl font-bold text-[#05df72] mb-4 text-center">Receive a File</h2>
            <input
                type="text"
                placeholder="Enter Code"
                className="w-full p-2 text-center text-base font-bold bg-[#171717] border rounded mb-4 text-white placeholder-white "
            />
            {incomingFileName && (
                <div className="mb-2 w-full text-left">
                    <p className="text-sm text-gray-300">Incoming File Details:</p>
                    <p className="text-base font-semibold text-blue-300">Name: {incomingFileName}</p>
                </div>
            )}
            <button type="button"
                className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700">
                Download File
            </button>

        </div>
    )
}
