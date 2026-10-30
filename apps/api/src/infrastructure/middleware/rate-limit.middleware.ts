import rateLimit from "express-rate-limit";

/*
|--------------------------------------------------------------------------
| RATE LIMITERS
| Different limits for different route sensitivity levels
|--------------------------------------------------------------------------
*/

// ── Global — 100 req per 15 min ───────────────────────────────────────────
export const globalLimiter = rateLimit({
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
    windowMs: 1 * 60 * 1000,
    max:      1000,
});

// ── File upload — 20 req per hour ────────────────────────────────────────
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max:      20,
    message: {
        success: false,
        message: "Too many file uploads. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders:   false,
});