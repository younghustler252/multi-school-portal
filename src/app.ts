import express, { Request, Response, NextFunction } from "express";
import cors                                          from "cors";
import helmet                                        from "helmet";
import morgan                                        from "morgan";
import rateLimit                                     from "express-rate-limit";
import cookieParser from "cookie-parser";
import { env }                                       from "./config/env";
import { errorHandler } from "./infrastructure/middleware/error-handler.middleware";
import { resolveTenant } from "./infrastructure/middleware/tenant-resolver.middleware";

import routes from "./routes";

const app = express();

// ── Security ─────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (/https:\/\/.*\.yourapp\.com$/.test(origin)) {
            callback(null, true);
        } else if (env.NODE_ENV === "development") {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      100,
    message: {
        success: false,
        message: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders:   false,
}));

// ── Body Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Logging ──────────────────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}
app.use(cookieParser());
app.use(resolveTenant);

// ── Health Check ─────────────────────────────────────────────────────────
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
        success:     true,
        message:     "Server is healthy 🚀",
        environment: env.NODE_ENV,
        timestamp:   new Date().toISOString(),
    });
});

// ── API Routes ───────────────────────────────────────────────────────────
app.use("/api/v1", routes);

// ── 404 Handler ──────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

// ── Global Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

export default app;