// to handle the webrtc's file transfer using socket io

import { Server as SocketIOServer, Socket } from 'socket.io'
import Transfer from '../models/Transfer'
import { nanoid } from 'nanoid' //package to generate unqiue id's


type IoInstance = SocketIOServer
//socket io signaling handler 

const initSignalingService = (io: IoInstance) => {
    io.on('connection', (socket: Socket) => {
        console.log(`socket connected: ${socket.id}`);


        // ***** SENDER SIDE EVENTS ****
        //sender side functions 
        //handling create-transfer from sender, generating unique code and storing transfer doc in db and 
        //sending back transfer created in db to sender with code.

        socket.on('create-transfer', async (data: { fileMetaData: any; senderId: string },
            callback: (response: { success: boolean; shareCode?: string; message?: string }) => void) => {
            //generating 8 char unique code
            let shareCode = nanoid(8).toUpperCase();
            let isUnique = false;

            while (!isUnique) { //to check if code is unique or not 
                const existingTransfer = await Transfer.findOne({ shareCode });
                if (!existingTransfer) {
                    isUnique = true;
                }
                else {
                    shareCode = nanoid(8).toUpperCase(); //if not generate again

                }
            }

            try {
                //creating new transfer doc in db
                const newTransfer = new Transfer({
                    shareCode,
                    senderId: data.senderId,
                    fileMetadata: data.fileMetaData,
                    status: 'pending',
                });

                await newTransfer.save() //saving the new transfer entry

            } catch (error: any) {
                console.error(`Error creating transfer: ${error.message}`);
                callback({ success: false, message: "failed to create transfer" });

            }

        });

        //handling send-offer event from sender, updating transfer doc with sender and sending received to receiver 
        //with the shared code

        socket.on('send-offer', async (data: { shareCode: string, offer: any, senderId: string }) => {
            try {
                const transfer = await Transfer.findOneAndUpdate({
                    shareCode: data.shareCode,
                    senderId: data.senderId,
                    status: 'pending'
                },
                    {
                        offer: JSON.stringify(data.offer),
                        status: 'connecting'
                    },
                    {
                        new: true
                    });

                if(transfer){
                    console.log(`Offer received for code: ${data.shareCode} from sender: ${data.senderId}`);
                    io.to(data.shareCode).emit('offer-received', { offer: data.offer, shareCode: data.shareCode, fileMetadata: transfer.fileMetadata});
                    
                }
                else{
                    console.warn(`Transfer not found or already processing: ${data.shareCode}`);
                    
                }
            }
            catch (error: any) {
                console.error(`Error processing offer: ${error.message}`);

            }
        })


        //send-canditate for ICE candidates, adding candidate to receiver/sender array in mongodb
        //emiting candidate-recived at other end 


        socket.on('send-candidate', async (data: {shareCode: string, candidate: any, isSender: boolean})=>{
            try {
                const updateField = data.isSender ? 'senderCandidates' : 'receiverCandidates';
                const transfer = await Transfer.findOneAndUpdate(
                    {shareCode: data.shareCode},
                    {$push: {[updateField]: data.candidate}},
                    {new: true}
                );

                if(transfer){
                    //emit candidate to other peer in same share code room
                    socket.to(data.shareCode).emit('candidate-received', {candidate: data.candidate, isSender: data.isSender})
                }else{
                    console.warn(`Transfer not found for candidate: ${data.shareCode}`);
                    
                }
                
            } catch (error:any) {
                console.error(`Error processing candidate: ${error.message}`);
                
            }
        });




        //******** RECEIVER END EVENTS 

        //'join-transfer' event for receiver, receiver joins room based on share code, 
        //get the offer and candidate from db and send it to receiver 

        socket.on('join-transfer', async (data: {shareCode: string, receiverId: string }, callback: (response: {success: boolean, message?:string, transfer?: any}) => void) => {
            socket.join(data.shareCode) //joining socket.io room
            console.log(`Socket ${socket.id} joined room ${data.shareCode} as receiver ${data.receiverId}`);

            try {
                const transfer = await Transfer.findOneAndUpdate(
                    {shareCode: data.shareCode, status: 'connecting'}, //fle transfer in connecting 
                    {receiverId: data.receiverId, status: 'active'}, //set reciver id and status to active
                    {new: true}
                );

                if(transfer && transfer.offer){
                    callback({success: true, transfer: {
                        shareCode: transfer.shareCode,
                        offer: JSON.parse(transfer.offer),
                        fileMetadata: transfer.fileMetadata,
                        senderCandidates: transfer.senderCandidates,
                        receiverCandidates: transfer.receiverCandidates //send existing candidates to new receiver..
                    }});

                    //notify sender that receiver has joined and ready to send
                    io.to(transfer.shareCode).emit('receiver-joined', {shareCode: transfer.shareCode});
                }
                else{
                    callback({success: false, message: 'Transfer not found'});
                    socket.leave(data.shareCode) //leave room if transfer not ready/found
                }
                
            } catch (error:any) {
                console.error(`Error joining transfer: ${error.message}`);
                callback({success: false, message: 'failed to join transfer process'})
                
            }
        });

        //handling 'send-answer' from receiver, updating transfer doc with receiver's SDP answer, and 
        //emiting 'answer-received' to sender

        socket.on('send-answer', async (data: {shareCode: string, answer: any, receiverId: string}) => {
            try {
                const transfer = await Transfer.findOneAndUpdate(
                    {shareCode: data.shareCode, receiverId: data.receiverId, status: 'active'},
                    {answer: JSON.stringify(data.answer)}, //storing answer as string
                    {new: true}
                )

                if(transfer){
                    console.log(`Answer received for code ${data.shareCode} from receiver ${data.receiverId}`);
                    //emiting answer to sender 
                    io.to(data.shareCode).emit('answer-received', {answer: data.answer, shareCode: data.shareCode})
                }
                
            } catch (error:any) {
                console.error(`Error processing answer: ${error.message}`);
            }
        })


        //handling 'transfer-complete' to update status of transfer to 'complete' in db

        socket.on('transfer-completed', async (data: {shareCode: string}) => {
            try {
                await Transfer.findOneAndUpdate(
                    {shareCode: data.shareCode},
                    {status: 'completed'}
                );

                console.log(`Transfer ${data.shareCode} is completed`);

                //notifying other peer if they are still connected
                socket.to(data.shareCode).emit('trasfer-finalized', {shareCode: data.shareCode, status: 'completed'})
                
                //on completion sockets can leave room
                io.in(data.shareCode).socketsLeave(data.shareCode)
            } catch (error:any) {
                console.error(`Error marking transfer complete: ${error.message}`);
            }
        });


        //****** DISCONNECTING 
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        })


    })
}

