//displays the progress bar and current connection status(connecting, pending, done)

'use client'
import React from "react"

interface StatusDisplayProps {
    connectionStatus: string,
    transferProgress: number
}


export default function StatusDisplay({ connectionStatus, transferProgress }: StatusDisplayProps) {
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-inner border border-blue-700 animate-fade-in-delay-3">
            <p className="text-lg font-semibold text-blue-300">
                Status: <span className={`${connectionStatus.includes('Connected') || connectionStatus.includes('successfully') || connectionStatus.includes('complete') ? 'text-green-500' : 'text-yellow-500'}`}>
                    {connectionStatus}
                </span>
            </p>
            {transferProgress > 0 && transferProgress < 100 && (
                <div className="w-full bg-gray-700 rounded-full h-3 mt-2">
                    <div
                        className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${transferProgress}%` }}
                    ></div>
                    <p className="text-sm text-gray-400 mt-1">{transferProgress.toFixed(1)}%</p>
                </div>
            )}
        </div>
    )
}