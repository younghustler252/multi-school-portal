/*
|--------------------------------------------------------------------------
| AUTH DOMAIN CONSTANTS
| Stable error codes (the frontend switches on these, never on message text)
| plus operational constants. These are code-level defaults; the password
| length rule is the only value read from settings (security.password_min_length).
|--------------------------------------------------------------------------
*/

export const AuthCodes = {
    INVALID_CREDENTIALS:   "INVALID_CREDENTIALS",
    ACCOUNT_INACTIVE:      "ACCOUNT_INACTIVE",
    ACCOUNT_LOCKED:        "ACCOUNT_LOCKED",
    EMAIL_NOT_VERIFIED:    "EMAIL_NOT_VERIFIED",
    LOGIN_RATE_LIMITED:    "LOGIN_RATE_LIMITED",
    INVALID_OTP:           "INVALID_OTP",
    OTP_MAX_ATTEMPTS:      "OTP_MAX_ATTEMPTS",
    REFRESH_TOKEN_INVALID: "REFRESH_TOKEN_INVALID",
    REFRESH_TOKEN_REUSED:  "REFRESH_TOKEN_REUSED",
    REFRESH_IN_PROGRESS:   "REFRESH_IN_PROGRESS",
    TENANT_MISMATCH:       "TENANT_MISMATCH",
    INVITE_EXPIRED:        "INVITE_EXPIRED",
    INVITE_ALREADY_USED:   "INVITE_ALREADY_USED",
    INVITE_REVOKED:        "INVITE_REVOKED",
    ROLE_NOT_ALLOWED:      "ROLE_NOT_ALLOWED",
    PERSONA_NOT_AVAILABLE: "PERSONA_NOT_AVAILABLE",
    IMPERSONATION_INVALID: "IMPERSONATION_INVALID",
} as const;

export enum OtpExpiryMinutes {
    EMAIL_VERIFICATION = 10,
    PASSWORD_RESET     = 15,
    TWO_FACTOR         = 5,
}

export const OTP_MAX_ATTEMPTS            = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const INVITE_EXPIRY_DAYS          = 7;

// Login protection
export const LOGIN_PAIR_MAX_FAILURES   = 5;          // per (email + IP)
export const LOGIN_PAIR_WINDOW_SECONDS = 15 * 60;
export const ACCOUNT_LOCK_THRESHOLD    = 20;         // total failures from any IP before the account itself locks
export const ACCOUNT_LOCK_MINUTES      = 30;

// Refresh rotation
export const REFRESH_REUSE_GRACE_SECONDS = 10;

// Impersonation sessions are short and cannot be refreshed past this limit
export const IMPERSONATION_MAX_MINUTES = 60;

export const DEFAULT_PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH         = 128;

// Subdomains that must never belong to a school (they collide with platform hosts)
export const RESERVED_SUBDOMAINS: readonly string[] = [
    "www", "admin", "api", "app", "mail", "smtp", "ftp", "support", "help",
    "status", "docs", "blog", "static", "assets", "cdn", "dev", "staging",
    "test", "demo", "portal", "login", "auth", "billing", "dashboard",
];

export const AuthMessage = {
    FORGOT_GENERIC: "If an account exists for this email, a reset code has been sent.",
    RESEND_GENERIC: "If this account needs verification, a new code has been sent.",
    EMAIL_VERIFIED: "Email verified successfully. You can now log in.",
    PASSWORD_RESET: "Password reset successfully. Please log in with your new password.",
    LOGGED_OUT:     "Logged out successfully",
    LOGIN_OK:       "Login successful",
} as const;
