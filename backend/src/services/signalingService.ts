// to handle the webrtc's file transfer using socket io



import { Server as SocketIOServer, Socket } from 'socket.io'
import Transfer from '../models/Transfer'
import { nanoid } from 'nanoid' //package to generate unqiue id's


type IoInstance = SocketIOServer
//socket io signaling handler 

const initSignalingService = (io: IoInstance) => {
    io.on('connection', (socket: Socket) => {
        console.log(`socket connected: ${socket.id}`);

        //sender side functions 
        //handling create-transfer from sender, generating unique code and storing transfer doc in db and 
        //sending back transfer created in db to sender with code.

        socket.on('create-transfer', async (data: { fileMetaData: any; senderId: string },
            callback: (response: { success: boolean; shareCode?: string; message?: string }) => void) => {
                //generating 8 char unique code
                let shareCode = nanoid(8).toUpperCase();
                let isUnique = false;

                while(!isUnique){ //to check if code is unique or not 
                    const existingTransfer = await Transfer.findOne({shareCode});
                    if(!existingTransfer){
                        isUnique = true;
                    }
                    else{
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
                    
                } catch (error:any) {
                    console.error(`Error creating transfer: ${error.message}`);
                    callback({success: false, message: "failed to create transfer"});
                    
                }

        });

        

    }
    )
}

