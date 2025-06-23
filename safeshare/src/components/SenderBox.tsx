// components/SenderBox.tsx
'use client';

import React, { useState, useCallback } from 'react';

export default function SenderBox(){
    

    return (
        <div className="bg-[#52525c] rounded-xl shadow-xl border border-teal-700 flex flex-col w-80 h-56 p-4">
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
            />
            <p className="text-gray-400 mt-2 text-sm text-center">
                Your file will be sent once the recipient enters this code.
            </p>
        </div>
    );
}
