import express, { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config({
    path: `.env.${process.env.NODE_ENV || "development"}`
});

const app = express();
app.use(express.json());


app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Server is working 🚀"
    });
});



export default app;