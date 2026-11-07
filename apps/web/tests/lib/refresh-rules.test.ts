import { describe, expect, it } from "vitest";
import { endsSession, isSessionlessAuthUrl, shouldRefreshFor } from "@/lib/api/refresh-rules";

describe("shouldRefreshFor", () => {
	it("refreshes on TOKEN_EXPIRED and on TOKEN_MISSING (the access cookie expires with the token)", () => {
		expect(shouldRefreshFor(401, "TOKEN_EXPIRED")).toBe(true);
		expect(shouldRefreshFor(401, "TOKEN_MISSING")).toBe(true);
	});

	it("does not refresh for anything else", () => {
		expect(shouldRefreshFor(401, "TOKEN_INVALID")).toBe(false);
		expect(shouldRefreshFor(401, "SESSION_INVALID")).toBe(false);
		expect(shouldRefreshFor(401, "UNKNOWN")).toBe(false);
		expect(shouldRefreshFor(403, "TOKEN_EXPIRED")).toBe(false);
		expect(shouldRefreshFor(null, "NETWORK_ERROR")).toBe(false);
	});
});

describe("endsSession", () => {
	it("ends the session when the token or membership is gone", () => {
		expect(endsSession(401, "TOKEN_INVALID")).toBe("invalid");
		expect(endsSession(401, "SESSION_INVALID")).toBe("invalid");
	});

	it("ends the session on a tenant mismatch", () => {
		expect(endsSession(401, "TENANT_MISMATCH")).toBe("tenant-mismatch");
		expect(endsSession(403, "TENANT_MISMATCH")).toBe("tenant-mismatch");
	});

	it("leaves ordinary failures alone", () => {
		expect(endsSession(403, "PERMISSION_DENIED")).toBeNull();
		expect(endsSession(401, "TOKEN_EXPIRED")).toBeNull();
		expect(endsSession(500, "UNKNOWN")).toBeNull();
	});
});

describe("isSessionlessAuthUrl", () => {
	it("is true for login, refresh, logout and the public auth flows (a 401 there is the real answer)", () => {
		for (const u of ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/verify-email", "/auth/forgot-password", "/auth/invite/accept", "/auth/login?x=1"]) {
			expect(isSessionlessAuthUrl(u)).toBe(true);
		}
	});

	it("is false for the /auth calls that need a session, and for everything else", () => {
		expect(isSessionlessAuthUrl("/auth/switch-persona")).toBe(false);
		expect(isSessionlessAuthUrl("/auth/logout-all")).toBe(false);
		expect(isSessionlessAuthUrl("/users/me")).toBe(false);
		expect(isSessionlessAuthUrl(undefined)).toBe(false);
	});
});
