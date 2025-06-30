'use client'
import React, { useState } from "react";
import ReceiverBox from "./ReceiverBox";
import SenderBox from "./SenderBox";

export default function SharePanel() {
    // Example state and handlers
    const [connectionStatus, setConnectionStatus] = useState("disconnected");
    const [transferProgres, setTransferProgres] = useState(0);

    // Dummy implementations for illustration
    const showInfoMessage = (msg: string) => alert(msg);
    const resetAllUIState = () => {
        setConnectionStatus("disconnected");
        setTransferProgres(0);
    };

    return (
        <div className="flex justify-center gap-5 mt-18 ml-18">
            <SenderBox
                connectionStatus={connectionStatus}
                setConnectionStatus={setConnectionStatus}
                setTransferProgres={setTransferProgres}
                showInfoMessage={showInfoMessage}
                resetAllUIState={resetAllUIState}
            />
            <ReceiverBox
                connectionStatus={connectionStatus}
                setConnectionStatus={setConnectionStatus}
                setTansferProgres={setTransferProgres}
                showInfoMessage={showInfoMessage}
                resetAllUIState={resetAllUIState}
            />
        </div>
    );
}