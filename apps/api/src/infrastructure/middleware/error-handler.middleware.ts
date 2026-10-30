import { env } from "../../config/env";
import { Sentry } from "../monitoring/sentry";
import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../../shared/errors/domain.errors";

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
| Every error response has the same shape:
|   { success: false, message, code?, details?, errors? }
| Only genuine server faults go to Sentry; client mistakes (validation,
| bad tokens, duplicate keys, 4xx AppErrors) do not.
|--------------------------------------------------------------------------
*/

const PRISMA_CLIENT_ERRORS: Record<string, { status: number; code: string; message: string }> = {
    P2002: { status: 409, code: "CONFLICT",          message: "A record with this value already exists" },
    P2025: { status: 404, code: "NOT_FOUND",         message: "Record not found" },
    P2003: { status: 400, code: "INVALID_REFERENCE", message: "Related record not found" },
};

const isClientError = (err: any): boolean =>
    err?.name === "ZodError" ||
    err?.name === "JsonWebTokenError" ||
    err?.name === "TokenExpiredError" ||
    err?.message === "Not allowed by CORS" ||
    Boolean(PRISMA_CLIENT_ERRORS[err?.code]) ||
    (err instanceof AppError && err.statusCode < 500);

export const errorHandler = (
    err:  any,
    req:  Request,
    res:  Response,
    _next: NextFunction,
): Response => {
    const unexpected = !isClientError(err);

    if (unexpected) {
        console.error("❌ Error:", err);
        Sentry.captureException(err, { extra: { path: req.originalUrl, method: req.method } });
    } else {
        console.warn(`⚠️  ${req.method} ${req.originalUrl} -> ${err?.code ?? err?.name}: ${err?.message}`);
    }

    // ── Zod (v3 exposes .errors, v4 exposes .issues) ─────────────────────
    if (err?.name === "ZodError") {
        const issues: any[] = err.issues ?? err.errors ?? [];
        const fields = issues.reduce((acc: Record<string, string>, e: any) => {
            acc[(e.path ?? []).join(".")] = e.message;
            return acc;
        }, {});

        return res.status(400).json({ success: false, message: "Validation failed", code: "VALIDATION_ERROR", errors: fields });
    }

    // ── Our own errors ───────────────────────────────────────────────────
    if (err instanceof AppError) {
        const serverFault = err.statusCode >= 500;
        const hideMessage = serverFault && !err.isOperational;       // never leak internals from non-operational 5xx errors
        const code        = err.code ?? (serverFault ? "INTERNAL_ERROR" : undefined);

        return res.status(err.statusCode).json({
            success: false,
            message: hideMessage ? "Internal server error" : err.message,
            ...(code        && { code }),
            ...(err.details && { details: err.details }),
            ...(err instanceof ValidationError && err.fields && { errors: err.fields }),
        });
    }

    // ── Prisma ───────────────────────────────────────────────────────────
    const prismaError = PRISMA_CLIENT_ERRORS[err?.code];
    if (prismaError) {
        return res.status(prismaError.status).json({ success: false, message: prismaError.message, code: prismaError.code });
    }

    // ── CORS ─────────────────────────────────────────────────────────────
    if (err?.message === "Not allowed by CORS") {
        return res.status(403).json({ success: false, message: "CORS policy violation", code: "CORS_FORBIDDEN" });
    }

    // ── JWT (safety net; authenticate() normally converts these first) ───
    if (err?.name === "JsonWebTokenError") {
        return res.status(401).json({ success: false, message: "Invalid token", code: "TOKEN_INVALID" });
    }
    if (err?.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Token expired", code: "TOKEN_EXPIRED" });
    }

    // ── Default 500 ──────────────────────────────────────────────────────
    return res.status(500).json({
        success: false,
        message: "Internal server error",
        code:    "INTERNAL_ERROR",
        ...(env.NODE_ENV === "development" && { stack: err?.stack }),
    });
};