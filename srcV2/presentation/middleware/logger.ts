import { RequestHandler } from "express";

/**
 * Middleware: Logger
 * Logs request method, URL, timestamp, and optionally user info
 */
export const logger: RequestHandler = (req, res, next) => {
    const { method, originalUrl } = req;
    const timestamp = new Date().toISOString();

    const userInfo = req.auth
        ? ` | userId: ${req.auth.userId} | tenantId: ${req.auth.tenantId} | role: ${req.auth.role}`
        : "";

    console.log(`[${timestamp}] ${method} ${originalUrl}${userInfo}`);

    next();
};
