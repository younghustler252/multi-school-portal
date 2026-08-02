import express, { Request, Response, NextFunction } from "express";
import cors                                          from "cors";
import helmet                                        from "helmet";
import morgan                                        from "morgan";
import rateLimit                                     from "express-rate-limit";
import cookieParser                                  from "cookie-parser";
import { env }                                       from "./config/env";
import { errorHandler }                              from "./infrastructure/middleware/error-handler.middleware";
import { globalLimiter } from "./infrastructure/middleware/rate-limit.middleware";
import { resolveTenant, validateTenantOwnership }    from "./infrastructure/middleware/tenant-resolver.middleware";
import { requireSuperAdmin } from "./infrastructure/middleware/rbac.middleware";
import { optionalAuthenticate, authenticate }                      from "./infrastructure/middleware/auth.middleware";
import { createBullBoardRouter } from "./infrastructure/jobs/bull-board";
import routes                                        from "./routes";

const app = express();

// ── Security ──────────────────────────────────────────────────────────────
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

app.use(globalLimiter);

// ── Body Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────────────
if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Optional Auth ─────────────────────────────────────────────────────────
// Pre-populates req.user if token present — doesn't block public routes
app.use(optionalAuthenticate);

// ── Tenant Resolution ─────────────────────────────────────────────────────
// Resolves school from subdomain or dev headers
app.use(resolveTenant);



// ── Tenant Ownership Validation ───────────────────────────────────────────
// If both req.user and req.schoolId exist — validate they match
app.use(validateTenantOwnership);

// ── Health Check ──────────────────────────────────────────────────────────
app.get("/api/v1/health", (req: Request, res: Response) => {
    res.status(200).json({
        success:     true,
        message:     "Server is healthy 🚀",
        environment: env.NODE_ENV,
        timestamp:   new Date().toISOString(),
    });
});

// ── API Routes ────────────────────────────────────────────────────────────
app.use("/api/v1", routes);
app.use(
    "/admin/queues",
    authenticate,
    requireSuperAdmin,
    createBullBoardRouter(),
);

// ── 404 Handler ───────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});

// ── Global Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

export default app;