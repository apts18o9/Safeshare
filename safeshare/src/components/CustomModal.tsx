//reusable modal component to show notification to user


'use client'
import React from "react"

interface CustomModalProps {
    message: string,
    onClose: () => void;
}


export default function CustomModal({message, onClose}: CustomModalProps){
    return(
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-500">
                <h3 className="text-xl font-semibold text-blue-400 mb-4">Notification</h3>
                <p className="text-lg text-white mb-6">{message}</p>
                <button
                    onClick={onClose}
                    className="w-full bg-blue-600 hover: bg-red-300 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105">
                </button>
            </div>
        </div>
    )
}