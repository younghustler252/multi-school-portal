/*
| One error type for every failed API call (API-001).
| The backend's failures do not all look alike (docs/backend/error-handling.md: validation 400s, 404s and rate-limit
| responses can lack a stable `code`), so everything is normalized here once and the rest of the app switches on `code`.
*/

/** Codes the backend sends that the web app reacts to. Anything else is passed through as a plain string. */
export const API_CODES = {
	TOKEN_MISSING: "TOKEN_MISSING",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	TOKEN_INVALID: "TOKEN_INVALID",
	SESSION_INVALID: "SESSION_INVALID",
	TENANT_MISMATCH: "TENANT_MISMATCH",
	REFRESH_TOKEN_INVALID: "REFRESH_TOKEN_INVALID",
	REFRESH_TOKEN_REUSED: "REFRESH_TOKEN_REUSED",
	REFRESH_IN_PROGRESS: "REFRESH_IN_PROGRESS",
	MUST_CHANGE_PASSWORD: "MUST_CHANGE_PASSWORD",
	MAINTENANCE_MODE: "MAINTENANCE_MODE",
	EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
	INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
	ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
	PERSONA_NOT_AVAILABLE: "PERSONA_NOT_AVAILABLE",
	// Synthesized on the client when the response carries no usable code
	VALIDATION_ERROR: "VALIDATION_ERROR",
	RATE_LIMITED: "RATE_LIMITED",
	NOT_FOUND: "NOT_FOUND",
	NETWORK_ERROR: "NETWORK_ERROR",
	UNKNOWN: "UNKNOWN",
} as const;

export type ApiCode = (typeof API_CODES)[keyof typeof API_CODES] | (string & {});

export class ApiError extends Error {
	readonly status: number | null;
	readonly code: ApiCode;
	readonly fieldErrors: Record<string, string>;
	readonly details: unknown;

	constructor(init: { message: string; status: number | null; code: ApiCode; fieldErrors?: Record<string, string>; details?: unknown }) {
		super(init.message);
		this.name = "ApiError";
		this.status = init.status;
		this.code = init.code;
		this.fieldErrors = init.fieldErrors ?? {};
		this.details = init.details;
	}

	is(...codes: ApiCode[]): boolean {
		return codes.includes(this.code);
	}
}

export function isApiError(value: unknown): value is ApiError {
	return value instanceof ApiError;
}

// Field maps arrive as { field: "msg" } or { field: ["msg", ...] } depending on which validator answered.
function toFieldErrors(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const out: Record<string, string> = {};
	for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
		if (typeof v === "string") out[key] = v;
		else if (Array.isArray(v) && typeof v[0] === "string") out[key] = v[0];
	}
	return out;
}

/** Turn whatever came back (HTTP status + parsed body, or nothing at all) into an ApiError. */
export function normalizeApiError(status: number | undefined | null, body: unknown, fallbackMessage = "Something went wrong. Please try again."): ApiError {
	const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	const message = typeof obj.message === "string" && obj.message ? obj.message : fallbackMessage;
	const fieldErrors = toFieldErrors(obj.errors);
	const rawCode = typeof obj.code === "string" && obj.code ? obj.code : null;

	let code: ApiCode;
	if (rawCode) code = rawCode;
	else if (status == null) code = API_CODES.NETWORK_ERROR;
	else if (status === 429) code = API_CODES.RATE_LIMITED;
	else if (status === 404) code = API_CODES.NOT_FOUND;
	else if (status === 400 && Object.keys(fieldErrors).length > 0) code = API_CODES.VALIDATION_ERROR;
	else code = API_CODES.UNKNOWN;

	return new ApiError({
		message: status == null && !obj.message ? "Cannot reach the server. Check your connection and try again." : message,
		status: status ?? null,
		code,
		fieldErrors,
		details: obj.details,
	});
}
