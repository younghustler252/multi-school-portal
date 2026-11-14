import rateLimit from "express-rate-limit";
import { Redis } from "ioredis";
import { RedisRateLimitStore } from "./redis-rate-limit.store";

/* RATE_LIMIT_STORE=redis shares counters between API replicas (REM-115). Default: per-process memory (fine for a single instance).
   Its own Redis client with a short request timeout, so an outage fails OPEN (passOnStoreError) instead of hanging requests. */
let shared: Redis | undefined;
function storeFor(name: string): { store: any; passOnStoreError: boolean } | {} {
    if (process.env.RATE_LIMIT_STORE !== "redis") return {};
    shared ??= new Redis({ host: process.env.REDIS_HOST ?? "localhost", port: parseInt(process.env.REDIS_PORT ?? "6379"), maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
    shared.on("error", () => { /* logged by the limiter via passOnStoreError; avoid unhandled 'error' events */ });
    return { store: new RedisRateLimitStore(shared as any, `rl:${name}:`), passOnStoreError: true };
}

/*
|--------------------------------------------------------------------------
| RATE LIMITERS
| Different limits for different route sensitivity levels
|--------------------------------------------------------------------------
*/

// ── Global — 100 req per 15 min ───────────────────────────────────────────
export const globalLimiter = rateLimit({
    ...storeFor("globalLimiter"),
    windowMs:        15 * 60 * 1000,
    max:             100,
    message: {
        success: false,
        message: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders:   false,
});

// ── Auth — 10 req per 15 min ──────────────────────────────────────────────
// Prevents brute force on login/register
export const authLimiter = rateLimit({
    ...storeFor("authLimiter"),
    windowMs:        15 * 60 * 1000,
    max:             10,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again in 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders:   false,
    skipSuccessfulRequests: true, // only count failed attempts
});

// ── OTP — 5 req per 15 min ────────────────────────────────────────────────
// Prevents OTP spam
export const otpLimiter = rateLimit({
    ...storeFor("otpLimiter"),
    windowMs:        15 * 60 * 1000,
    max:             5,
    message: {
        success: false,
        message: "Too many OTP requests. Please wait 15 minutes before trying again.",
    },
    standardHeaders: true,
    legacyHeaders:   false,
});

// ── Webhook — no limit ────────────────────────────────────────────────────
// Paystack/Flutterwave webhooks should never be rate limited
export const webhookLimiter = rateLimit({
    ...storeFor("webhookLimiter"),
    windowMs: 1 * 60 * 1000,
    max:      1000,
});

// ── File upload — 20 req per hour ────────────────────────────────────────
export const uploadLimiter = rateLimit({
    ...storeFor("uploadLimiter"),
    windowMs: 60 * 60 * 1000,
    max:      20,
    message: {
        success: false,
        message: "Too many file uploads. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders:   false,
});