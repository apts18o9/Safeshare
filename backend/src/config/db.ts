import mongoose from 'mongoose'

import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || ''

//connecting to mongodb 

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("MongoDB connected successfully");
    } catch (error) { //if not able to connect 
        console.error(`MongoDB connection error: ${error.message}`);
        
    }
}

export default connectDB