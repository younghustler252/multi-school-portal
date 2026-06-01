import mongoose from "mongoose"

const MONGO_URI = process.env.MONGO_URI

const connectDb = async (): Promise<void> => {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is not defined")
        }

        await mongoose.connect(MONGO_URI)
        console.log("MongoDB connected ✅")
    } catch (error) {
        console.error("MongoDB connection failed ❌", (error as Error).message)
        process.exit(1)
    }
}

export default connectDb
