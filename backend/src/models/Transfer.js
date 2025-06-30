"use strict";
//interface and schema for the transfer documents
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
//mongoose schema for the transfer interface
var TransferSchema = new mongoose_1.Schema({
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
var Transfer = mongoose_1.default.model('Transfer', TransferSchema);
exports.default = Transfer;
