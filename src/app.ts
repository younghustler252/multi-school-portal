import express, { Request, Response } from "express";
import * as dotenv from "dotenv";
import connectDb from "./config/db";

// middlewares
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/errorHandler";

// routes (example)
import authRoutes from "./routes/auth.routes";
// import schoolRoutes from "./routes/school.routes";

dotenv.config();

const app = express();


// -------------------
// Global Middlewares
// -------------------

// parse JSON body
app.use(express.json());

// request logger (should be early)
app.use(logger);

// -------------------
// Routes
// -------------------

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Server is working 🚀"
    });
});

// route groups
app.use("/api/auth", authRoutes);
// app.use("/api/schools", schoolRoutes);

// -------------------
// Error Handler (LAST)
// -------------------

app.use(errorHandler);

export default app;
