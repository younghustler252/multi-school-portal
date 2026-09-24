/*
|--------------------------------------------------------------------------
| AUTH DOMAIN ENUMS
| Module-level enums not in Prisma schema
|--------------------------------------------------------------------------
*/

export enum AuthErrorMessage {
    INVALID_CREDENTIALS    = "Invalid email or password",
    EMAIL_NOT_VERIFIED     = "Please verify your email before logging in",
    ACCOUNT_INACTIVE       = "Your account has been deactivated",
    ACCOUNT_LOCKED         = "Account temporarily locked due to too many failed attempts",
    EMAIL_ALREADY_EXISTS   = "An account with this email already exists",
    INVALID_OTP            = "Invalid or expired verification code",
    OTP_EXPIRED            = "Verification code has expired",
    OTP_MAX_ATTEMPTS       = "Too many incorrect attempts. Please request a new code",
    INVALID_REFRESH_TOKEN  = "Invalid or expired refresh token",
    INVITE_NOT_FOUND       = "Invite not found or has expired",
    INVITE_ALREADY_USED    = "This invite has already been accepted",
    UNAUTHORIZED           = "You are not authorized to perform this action",
}

export enum OtpExpiryMinutes {
    EMAIL_VERIFICATION = 10,
    PASSWORD_RESET     = 15,
    TWO_FACTOR         = 5,
}

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCK_DURATION_MINUTES     = 1;
export const INVITE_EXPIRY_DAYS        = 7;