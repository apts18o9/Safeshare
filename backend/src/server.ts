import express from 'express'
import http from 'http'
import cors from 'cors'
import dotenv from 'dotenv'
import { Server as SocketIOServer} from 'socket.io'
import initCleanupService from './services/cleanupService'
import initSignalingService from './services/signalingService'
import connectDB from './config/db'
dotenv.config()

const app = express();
const server = http.createServer(app) //creating a http server from express app


//cors

const FRONTEND_URL = process.env.FRONTEND_URL 
const io = new SocketIOServer(server, {
    cors: {
        origin: FRONTEND_URL || 'http://localhost:3000',
        methods: ["POST", "GET"],
        credentials: true
    }
});

app.use(express.json())
app.use(cors({
    origin: FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}))

initSignalingService(io)
initCleanupService()
//routes

app.get('/', (req,res) => {
    res.send('WebRTC Signaling server is running');
});

connectDB();

const PORT = process.env.PORT 
server.listen(PORT, () => console.log(`server running on port: ${PORT}`));
