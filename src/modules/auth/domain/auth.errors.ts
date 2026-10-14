import {
    UnauthorizedError,
    ForbiddenError,
    BadRequestError,
    ConflictError,
    NotFoundError,
    AppError,
} from "../../../shared/errors/domain.errors";
import { AuthCodes } from "./auth.enums";

/*
|--------------------------------------------------------------------------
| AUTH ERROR FACTORIES
| The ONLY place the auth module builds domain errors.
| Verified against domain.errors.ts: UnauthorizedError(message, code), ForbiddenError(message, code, details),
| BadRequest/Conflict/NotFound take one argument with fixed codes. Codes without a dedicated class
| (429 login limit, 503 registration) use AppError directly.
|--------------------------------------------------------------------------
*/

export const authErrors = {
    invalidCredentials: () => new UnauthorizedError("Invalid email or password", AuthCodes.INVALID_CREDENTIALS),
    accountInactive:    () => new ForbiddenError("Your account has been deactivated", AuthCodes.ACCOUNT_INACTIVE),
    accountLocked:      () => new ForbiddenError("Account temporarily locked. Try again later or reset your password", AuthCodes.ACCOUNT_LOCKED),
    emailNotVerified:   () => new ForbiddenError("Please verify your email before logging in", AuthCodes.EMAIL_NOT_VERIFIED),
    registrationLimited: () => new AppError("Too many registrations from this network. Please try again tomorrow", 429, true, "REGISTRATION_RATE_LIMITED"),
    loginRateLimited:   () => new AppError("Too many attempts. Please wait a few minutes and try again", 429, true, AuthCodes.LOGIN_RATE_LIMITED),

    invalidOtp:         () => new ForbiddenError("Invalid or expired verification code", AuthCodes.INVALID_OTP),
    otpMaxAttempts:     () => new ForbiddenError("Too many incorrect attempts. Please request a new code", AuthCodes.OTP_MAX_ATTEMPTS),

    refreshInvalid:     () => new UnauthorizedError("Session is no longer valid. Please log in again", AuthCodes.REFRESH_TOKEN_INVALID),
    refreshReused:      () => new UnauthorizedError("Session was revoked. Please log in again", AuthCodes.REFRESH_TOKEN_REUSED),
    refreshInProgress:  () => new UnauthorizedError("Session is being refreshed. Retry the request", AuthCodes.REFRESH_IN_PROGRESS),
    tenantMismatch:     () => new ForbiddenError("This session does not belong to this school", AuthCodes.TENANT_MISMATCH),

    inviteInvalid:      () => new NotFoundError("Invite"),
    inviteExpired:      () => new ForbiddenError("This invite has expired. Ask your administrator to send a new one", AuthCodes.INVITE_EXPIRED),
    inviteUsed:         () => new ForbiddenError("This invite has already been accepted", AuthCodes.INVITE_ALREADY_USED),
    inviteRevoked:      () => new ForbiddenError("This invite is no longer valid", AuthCodes.INVITE_REVOKED),
    alreadyMember:      () => new ConflictError("This person already has access to this school in that capacity"),
    roleNotAllowed:     () => new ForbiddenError("You cannot grant a role with more access than you hold", AuthCodes.ROLE_NOT_ALLOWED),
    personaUnavailable: () => new ForbiddenError("That profile is not available for this account", AuthCodes.PERSONA_NOT_AVAILABLE),
    impersonationInvalid: () => new UnauthorizedError("Invalid or expired impersonation link", AuthCodes.IMPERSONATION_INVALID),

    emailExists:        () => new ConflictError("An account with this email already exists"),
    subdomainTaken:     () => new ConflictError("This subdomain is already taken. Please choose another"),
    subdomainReserved:  () => new ConflictError("This subdomain is not available. Please choose another"),
    schoolEmailTaken:   () => new ConflictError("A school with this email already exists"),
    weakPassword:       (message: string) => new BadRequestError(message),
    badRequest:         (message: string) => new BadRequestError(message),
    notFound:           (what: string)    => new NotFoundError(what),
    registrationUnavailable: () => new AppError("Registration is temporarily unavailable", 503, true, "REGISTRATION_UNAVAILABLE"),
};
