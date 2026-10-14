/*
|--------------------------------------------------------------------------
| DOMAIN ERRORS
| Typed errors thrown from use cases and middleware, caught by the global
| error handler. `code` is a stable machine-readable string the frontend can
| switch on (show an upgrade prompt, refresh a token, ...). `details` carries
| structured context for that code.
|--------------------------------------------------------------------------
*/

export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
    public readonly statusCode:    number;
    public readonly isOperational: boolean;
    public readonly code?:         string;
    public readonly details?:      ErrorDetails;

    constructor(message: string, statusCode: number, isOperational = true, code?: string, details?: ErrorDetails) {
        super(message);
        this.statusCode    = statusCode;
        this.isOperational = isOperational;
        this.code          = code;
        this.details       = details;
        this.name          = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);
    }
}

// ── 400 ─────────────────────────────────────────────────────────────────
export class ValidationError extends AppError {
    public readonly fields?: Record<string, string>;

    constructor(message: string, fields?: Record<string, string>) {
        super(message, 400, true, "VALIDATION_ERROR");
        this.fields = fields;
    }
}

export class BadRequestError extends AppError {
    constructor(message: string) {
        super(message, 400, true, "BAD_REQUEST");
    }
}

// ── 401 ─────────────────────────────────────────────────────────────────
// Codes the frontend relies on: TOKEN_MISSING, TOKEN_EXPIRED (try a refresh),
// TOKEN_INVALID, SESSION_INVALID (membership gone), UNAUTHORIZED.
export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
        super(message, 401, true, code);
    }
}

// ── 403 ─────────────────────────────────────────────────────────────────
export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", code = "FORBIDDEN", details?: ErrorDetails) {
        super(message, 403, true, code, details);
    }
}

export class PermissionDeniedError extends AppError {
    constructor(permission: string) {
        super("You do not have permission to do this.", 403, true, "PERMISSION_DENIED", { permission });
    }
}

export class TenantMismatchError extends AppError {
    constructor() {
        super("Your account does not belong to this school portal.", 403, true, "TENANT_MISMATCH");
    }
}

// ── 404 ─────────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
    constructor(resource = "Resource") {
        super(`${resource} not found`, 404, true, "NOT_FOUND");
    }
}

// ── 409 ─────────────────────────────────────────────────────────────────
export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, true, "CONFLICT");
    }
}

// ── 422 ─────────────────────────────────────────────────────────────────
export class UnprocessableError extends AppError {
    constructor(message: string) {
        super(message, 422, true, "UNPROCESSABLE");
    }
}

// ── 429 ─────────────────────────────────────────────────────────────────
export class RateLimitError extends AppError {
    constructor(message = "Too many requests") {
        super(message, 429, true, "RATE_LIMITED");
    }
}

// ── 403 Feature gating ──────────────────────────────────────────────────
export class PlanLimitError extends AppError {
    constructor(message: string, details?: { key?: string; limit?: number; current?: number }) {
        super(message, 403, true, "PLAN_LIMIT_REACHED", details);
    }
}

export class FeatureNotAvailableError extends AppError {
    constructor(feature: string) {
        super(`Your current plan does not support: ${feature}`, 403, true, "FEATURE_NOT_AVAILABLE", { feature });
    }
}

// ── 500 ─────────────────────────────────────────────────────────────────
export class InternalError extends AppError {
    constructor(message = "Internal server error") {
        super(message, 500, false, "INTERNAL_ERROR");
    }
}