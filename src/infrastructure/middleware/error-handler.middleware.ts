import { env } from "../../config/env";
import { Sentry } from "../monitoring/sentry";
import { Request, Response, NextFunction } from "express";
import {
    AppError,
    ValidationError,
} from "../../shared/errors/domain.errors";

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER MIDDLEWARE
| Catches all errors thrown from controllers and use cases
|--------------------------------------------------------------------------
*/
export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
): Response => {

    console.error("❌ Error:", err);

    // ── Sentry: capture unexpected/server errors ──────────────────────────
    const isUnexpected =
        !(err instanceof AppError) ||
        err.statusCode >= 500;

    if (isUnexpected) {
        Sentry.captureException(err, {
            extra: {
                path: req.originalUrl,
                method: req.method,
            },
        });
    }

    // ── Zod Validation Error ─────────────────────────────────────────────
    if (err.name === "ZodError") {
        const fields = err.errors.reduce((acc: any, e: any) => {
            acc[e.path.join(".")] = e.message;
            return acc;
        }, {});

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: fields,
        });
    }

    // ── Our Custom App Errors ────────────────────────────────────────────
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err instanceof ValidationError &&
                err.fields && { errors: err.fields }),
        });
    }

    // ── Prisma Errors ────────────────────────────────────────────────────
    if (err.code === "P2002") {
        return res.status(409).json({
            success: false,
            message: "A record with this value already exists",
        });
    }

    if (err.code === "P2025") {
        return res.status(404).json({
            success: false,
            message: "Record not found",
        });
    }

    if (err.code === "P2003") {
        return res.status(400).json({
            success: false,
            message: "Related record not found",
        });
    }

    // ── CORS Error ───────────────────────────────────────────────────────
    if (err.message === "Not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "CORS policy violation",
        });
    }

    // ── JWT Errors ───────────────────────────────────────────────────────
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            success: false,
            message: "Invalid token",
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            success: false,
            message: "Token expired",
        });
    }

    // ── Default 500 ──────────────────────────────────────────────────────
    return res.status(500).json({
        success: false,
        message: "Internal server error",
        ...(env.NODE_ENV === "development" && {
            stack: err.stack,
        }),
    });
};
