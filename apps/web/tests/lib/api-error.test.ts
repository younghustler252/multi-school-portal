import { describe, expect, it } from "vitest";
import { API_CODES, ApiError, isApiError, normalizeApiError } from "@/lib/api/api-error";

describe("normalizeApiError", () => {
	it("keeps the code, message and status the API sent", () => {
		const e = normalizeApiError(401, { success: false, message: "Token expired", code: "TOKEN_EXPIRED" });
		expect(e).toBeInstanceOf(ApiError);
		expect(e.code).toBe("TOKEN_EXPIRED");
		expect(e.message).toBe("Token expired");
		expect(e.status).toBe(401);
	});

	it("gives a rate-limit response without a code the code RATE_LIMITED", () => {
		expect(normalizeApiError(429, { message: "Too many requests" }).code).toBe(API_CODES.RATE_LIMITED);
	});

	it("gives a 404 without a code the code NOT_FOUND", () => {
		expect(normalizeApiError(404, { message: "Not found" }).code).toBe(API_CODES.NOT_FOUND);
	});

	it("treats a 400 with a field map and no code as VALIDATION_ERROR", () => {
		const e = normalizeApiError(400, { success: false, message: "Validation failed", errors: { email: "Invalid email" } });
		expect(e.code).toBe(API_CODES.VALIDATION_ERROR);
		expect(e.fieldErrors).toEqual({ email: "Invalid email" });
	});

	it("flattens field errors that arrive as arrays (the global handler's shape)", () => {
		const e = normalizeApiError(400, { message: "Validation failed", code: "VALIDATION_ERROR", errors: { email: ["Bad", "Worse"], age: "Too young", junk: 3 } });
		expect(e.fieldErrors).toEqual({ email: "Bad", age: "Too young" });
	});

	it("reports a missing response as NETWORK_ERROR with a readable message", () => {
		const e = normalizeApiError(undefined, undefined);
		expect(e.code).toBe(API_CODES.NETWORK_ERROR);
		expect(e.status).toBeNull();
		expect(e.message.length > 0).toBe(true);
	});

	it("survives a body that is not an object (an HTML error page, a string)", () => {
		expect(normalizeApiError(502, "<html>Bad gateway</html>").code).toBe(API_CODES.UNKNOWN);
		expect(normalizeApiError(500, null).message.length > 0).toBe(true);
	});

	it("is() matches any of the given codes", () => {
		const e = normalizeApiError(401, { code: "TOKEN_MISSING", message: "x" });
		expect(e.is("TOKEN_EXPIRED", "TOKEN_MISSING")).toBe(true);
		expect(e.is("TOKEN_INVALID")).toBe(false);
		expect(isApiError(e)).toBe(true);
		expect(isApiError(new Error("x"))).toBe(false);
	});
});
