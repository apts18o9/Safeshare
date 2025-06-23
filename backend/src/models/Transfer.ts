//interface and schema for the transfer documents


import mongoose, { Document, Schema } from "mongoose";

//interface for single ICE candidate
interface IceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment?: string;
}


//interface for file metadata
interface FileMetadata {
    name: string;
    type: string;
    size: number;
}


//interface for transfer document 
export interface ITransfer extends Document {
    shareCode: string;
    offer: string;
    answer: string;
    senderId: string;
    receiverId: string;
    fileMetadata: FileMetadata;
    status: 'pending' | 'connecting' | 'active' | 'expired' | 'completed' | 'finished';
    createdAt: Date;
    updatedAt: Date;
    senderCandidates: IceCandidate[];
    receiverCandidates: IceCandidate[];

}


//mongoose schema for the transfer interface

const TransferSchema: Schema = new Schema({
    shareCode: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    offer: {
        type: String,
        required: false,
    },
    answer: {
        type: String,
        required: false, // Answer will be added by receiver
    },
    senderId: {
        type: String,
        required: true,
    },
    receiverId: {
        type: String,
        required: false, // Receiver ID will be added once a receiver joins
    },
    fileMetadata: {
        type: Object,
        required: false, // File metadata might be added later
        properties: {
            name: { type: String, required: true },
            size: { type: Number, required: true },
            type: { type: String, required: true },
        },
    },
    status: {
        type: String,
        enum: ['pending', 'connecting', 'active', 'completed', 'cancelled', 'expired'],
        default: 'pending',
    },
    senderCandidates: {
        type: [Object], // Array of objects for ICE candidates
        default: [],
    },
    receiverCandidates: {
        type: [Object],
        default: [],
    },
}, {
    timestamps: true, // Mongoose will automatically add createdAt and updatedAt fields
});


//exporting the mongoose model

const Transfer = mongoose.model<ITransfer>('Transfer', TransferSchema)
export default Transfer;

