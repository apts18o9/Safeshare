"use strict";
// to handle the webrtc's file transfer using socket io
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var Transfer_1 = require("../models/Transfer");
var nanoid_1 = require("nanoid"); //package to generate unqiue id's
//socket io signaling handler 
var initSignalingService = function (io) {
    io.on('connection', function (socket) {
        console.log("socket connected: ".concat(socket.id));
        // ***** SENDER SIDE EVENTS ****
        //sender side functions 
        //handling create-transfer from sender, generating unique code and storing transfer doc in db and 
        //sending back transfer created in db to sender with code.
        socket.on('create-transfer', function (data, callback) { return __awaiter(void 0, void 0, void 0, function () {
            var shareCode, isUnique, existingTransfer, newTransfer, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        shareCode = (0, nanoid_1.nanoid)(8).toUpperCase();
                        isUnique = false;
                        _a.label = 1;
                    case 1:
                        if (!!isUnique) return [3 /*break*/, 3];
                        return [4 /*yield*/, Transfer_1.default.findOne({ shareCode: shareCode })];
                    case 2:
                        existingTransfer = _a.sent();
                        if (!existingTransfer) {
                            isUnique = true;
                        }
                        else {
                            shareCode = (0, nanoid_1.nanoid)(8).toUpperCase(); //if not generate again
                        }
                        return [3 /*break*/, 1];
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        newTransfer = new Transfer_1.default({
                            shareCode: shareCode,
                            senderId: data.senderId,
                            fileMetadata: data.fileMetaData,
                            status: 'pending',
                        });
                        return [4 /*yield*/, newTransfer.save()]; //saving the new transfer entry
                    case 4:
                        _a.sent(); //saving the new transfer entry
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error("Error creating transfer: ".concat(error_1.message));
                        callback({ success: false, message: "failed to create transfer" });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        }); });
        //handling send-offer event from sender, updating transfer doc with sender and sending received to receiver 
        //with the shared code
        socket.on('send-offer', function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var transfer, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Transfer_1.default.findOneAndUpdate({
                                shareCode: data.shareCode,
                                senderId: data.senderId,
                                status: 'pending'
                            }, {
                                offer: JSON.stringify(data.offer),
                                status: 'connecting'
                            }, {
                                new: true
                            })];
                    case 1:
                        transfer = _a.sent();
                        if (transfer) {
                            console.log("Offer received for code: ".concat(data.shareCode, " from sender: ").concat(data.senderId));
                            io.to(data.shareCode).emit('offer-received', { offer: data.offer, shareCode: data.shareCode, fileMetadata: transfer.fileMetadata });
                        }
                        else {
                            console.warn("Transfer not found or already processing: ".concat(data.shareCode));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        console.error("Error processing offer: ".concat(error_2.message));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        //send-canditate for ICE candidates, adding candidate to receiver/sender array in mongodb
        //emiting candidate-recived at other end 
        socket.on('send-candidate', function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var updateField, transfer, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        updateField = data.isSender ? 'senderCandidates' : 'receiverCandidates';
                        return [4 /*yield*/, Transfer_1.default.findOneAndUpdate({ shareCode: data.shareCode }, { $push: (_a = {}, _a[updateField] = data.candidate, _a) }, { new: true })];
                    case 1:
                        transfer = _b.sent();
                        if (transfer) {
                            //emit candidate to other peer in same share code room
                            socket.to(data.shareCode).emit('candidate-received', { candidate: data.candidate, isSender: data.isSender });
                        }
                        else {
                            console.warn("Transfer not found for candidate: ".concat(data.shareCode));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _b.sent();
                        console.error("Error processing candidate: ".concat(error_3.message));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        //******** RECEIVER END EVENTS 
        //'join-transfer' event for receiver, receiver joins room based on share code, 
        //get the offer and candidate from db and send it to receiver 
        socket.on('join-transfer', function (data, callback) { return __awaiter(void 0, void 0, void 0, function () {
            var transfer, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        socket.join(data.shareCode); //joining socket.io room
                        console.log("Socket ".concat(socket.id, " joined room ").concat(data.shareCode, " as receiver ").concat(data.receiverId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Transfer_1.default.findOneAndUpdate({ shareCode: data.shareCode, status: 'connecting' }, //fle transfer in connecting 
                            { receiverId: data.receiverId, status: 'active' }, //set reciver id and status to active
                            { new: true })];
                    case 2:
                        transfer = _a.sent();
                        if (transfer && transfer.offer) {
                            callback({ success: true, transfer: {
                                    shareCode: transfer.shareCode,
                                    offer: JSON.parse(transfer.offer),
                                    fileMetadata: transfer.fileMetadata,
                                    senderCandidates: transfer.senderCandidates,
                                    receiverCandidates: transfer.receiverCandidates //send existing candidates to new receiver..
                                } });
                            //notify sender that receiver has joined and ready to send
                            io.to(transfer.shareCode).emit('receiver-joined', { shareCode: transfer.shareCode });
                        }
                        else {
                            callback({ success: false, message: 'Transfer not found' });
                            socket.leave(data.shareCode); //leave room if transfer not ready/found
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_4 = _a.sent();
                        console.error("Error joining transfer: ".concat(error_4.message));
                        callback({ success: false, message: 'failed to join transfer process' });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        //handling 'send-answer' from receiver, updating transfer doc with receiver's SDP answer, and 
        //emiting 'answer-received' to sender
        socket.on('send-answer', function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var transfer, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Transfer_1.default.findOneAndUpdate({ shareCode: data.shareCode, receiverId: data.receiverId, status: 'active' }, { answer: JSON.stringify(data.answer) }, //storing answer as string
                            { new: true })];
                    case 1:
                        transfer = _a.sent();
                        if (transfer) {
                            console.log("Answer received for code ".concat(data.shareCode, " from receiver ").concat(data.receiverId));
                            //emiting answer to sender 
                            io.to(data.shareCode).emit('answer-received', { answer: data.answer, shareCode: data.shareCode });
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        console.error("Error processing answer: ".concat(error_5.message));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        //handling 'transfer-complete' to update status of transfer to 'complete' in db
        socket.on('transfer-completed', function (data) { return __awaiter(void 0, void 0, void 0, function () {
            var error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Transfer_1.default.findOneAndUpdate({ shareCode: data.shareCode }, { status: 'completed' })];
                    case 1:
                        _a.sent();
                        console.log("Transfer ".concat(data.shareCode, " is completed"));
                        //notifying other peer if they are still connected
                        socket.to(data.shareCode).emit('trasfer-finalized', { shareCode: data.shareCode, status: 'completed' });
                        //on completion sockets can leave room
                        io.in(data.shareCode).socketsLeave(data.shareCode);
                        return [3 /*break*/, 3];
                    case 2:
                        error_6 = _a.sent();
                        console.error("Error marking transfer complete: ".concat(error_6.message));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        //****** DISCONNECTING 
        socket.on('disconnect', function () {
            console.log("Socket disconnected: ".concat(socket.id));
        });
    });
};
exports.default = initSignalingService;
