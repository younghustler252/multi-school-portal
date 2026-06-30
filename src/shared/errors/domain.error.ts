/*
|--------------------------------------------------------------------------
| DOMAIN ERRORS
| Typed errors thrown from use cases and caught by the global error handler
|--------------------------------------------------------------------------
*/

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode        = statusCode;
        this.isOperational     = isOperational;
        this.name              = this.constructor.name;

        Error.captureStackTrace(this, this.constructor);
    }
}

// ── 400 ─────────────────────────────────────────────────────────────────
export class ValidationError extends AppError {
    public readonly fields?: Record<string, string>;

    constructor(message: string, fields?: Record<string, string>) {
        super(message, 400);
        this.fields = fields;
    }
}

export class BadRequestError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

// ── 401 ─────────────────────────────────────────────────────────────────
export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    }
}

// ── 403 ─────────────────────────────────────────────────────────────────
export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403);
    }
}

// ── 404 ─────────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
    constructor(resource = "Resource") {
        super(`${resource} not found`, 404);
    }
}

// ── 409 ─────────────────────────────────────────────────────────────────
export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409);
    }
}

// ── 422 ─────────────────────────────────────────────────────────────────
export class UnprocessableError extends AppError {
    constructor(message: string) {
        super(message, 422);
    }
}

// ── 429 ─────────────────────────────────────────────────────────────────
export class RateLimitError extends AppError {
    constructor(message = "Too many requests") {
        super(message, 429);
    }
}

// ── 403 Feature gating ──────────────────────────────────────────────────
export class PlanLimitError extends AppError {
    constructor(message: string) {
        super(message, 403);
    }
}

export class FeatureNotAvailableError extends AppError {
    constructor(feature: string) {
        super(`Your current plan does not support: ${feature}`, 403);
    }
}

// ── 500 ─────────────────────────────────────────────────────────────────
export class InternalError extends AppError {
    constructor(message = "Internal server error") {
        super(message, 500, false);
    }
}