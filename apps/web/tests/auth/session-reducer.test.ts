import { describe, expect, it } from "vitest";
import type { MyPermissions } from "@schoolos/contracts";
import { initialSessionState, sessionReducer, type SessionEvent } from "@/lib/auth/session-reducer";
import type { Profile, SessionState } from "@/lib/auth/session-types";

const profile: Profile = {
	id: "u1", email: "a@b.c", firstName: "Ada", lastName: "Obi", phone: null, photoUrl: null,
	isEmailVerified: true, lastLoginAt: null, createdAt: "2026-01-01T00:00:00.000Z",
	session: { kind: "school", schoolId: "s1", persona: "STAFF", impersonating: false },
};
const permissions: MyPermissions = {
	realm: "school", persona: "STAFF", roles: ["teacher"], holdsEverything: false,
	permissions: [{ key: "students.view", scope: "ALL" }],
	branches: { all: [], assigned: [], schoolHasSeveral: false },
};

const run = (state: SessionState, ...events: SessionEvent[]) => events.reduce(sessionReducer, state);
const ready = run(initialSessionState, { type: "bootstrapSucceeded", profile, permissions });

describe("sessionReducer", () => {
	it("starts in loading with nothing known", () => {
		expect(initialSessionState.status).toBe("loading");
		expect(initialSessionState.profile).toBeNull();
		expect(initialSessionState.permissions).toBeNull();
	});

	it("becomes ready only with profile AND permissions together", () => {
		expect(ready.status).toBe("ready");
		expect(ready.profile).toEqual(profile);
		expect(ready.permissions).toEqual(permissions);
	});

	it("becomes unauthenticated when the bootstrap is rejected", () => {
		const s = run(initialSessionState, { type: "bootstrapRejected" });
		expect(s.status).toBe("unauthenticated");
		expect(s.profile).toBeNull();
	});

	it("asks for a new password when the API says so during bootstrap", () => {
		expect(run(initialSessionState, { type: "mustChangePassword" }).status).toBe("must-change-password");
	});

	it("a late bootstrap result cannot bring back a session that already ended", () => {
		const ended = run(initialSessionState, { type: "sessionEnded", reason: "expired" });
		const late = sessionReducer(ended, { type: "bootstrapSucceeded", profile, permissions });
		expect(late.status).toBe("unauthenticated");
		expect(late.profile).toBeNull();
		expect(late.permissions).toBeNull();
	});

	it("a late bootstrap rejection cannot sign out a session that is ready", () => {
		expect(sessionReducer(ready, { type: "bootstrapRejected" })).toBe(ready);
	});

	it("persona and school selection are their own state, and can be cancelled", () => {
		const sel = run(ready, { type: "selectionRequired", selection: { kind: "persona", personas: ["STAFF", "GUARDIAN"] } });
		expect(sel.status).toBe("selecting");
		expect(sel.profile).toBeNull();
		expect(sel.selection).toEqual({ kind: "persona", personas: ["STAFF", "GUARDIAN"] });
		const back = sessionReducer(sel, { type: "selectionCancelled" });
		expect(back.status).toBe("unauthenticated");
		expect(back.selection).toBeNull();
	});

	it("an authenticated login goes back to loading so exactly one bootstrap follows", () => {
		const s = run(ready, { type: "loginAuthenticated" });
		expect(s.status).toBe("loading");
		expect(s.profile).toBeNull();
		expect(s.permissions).toBeNull();
	});

	it("a login that demands a password change skips the bootstrap", () => {
		expect(run(initialSessionState, { type: "loginMustChangePassword" }).status).toBe("must-change-password");
	});

	it("after the password change the session reloads", () => {
		const s = run(initialSessionState, { type: "mustChangePassword" }, { type: "passwordChanged" });
		expect(s.status).toBe("loading");
	});

	it("passwordChanged does nothing outside must-change-password", () => {
		expect(sessionReducer(ready, { type: "passwordChanged" })).toBe(ready);
	});

	it("must-change-password raised on an unauthenticated session is ignored", () => {
		const out = run(initialSessionState, { type: "bootstrapRejected" });
		expect(sessionReducer(out, { type: "mustChangePassword" })).toBe(out);
	});

	it("must-change-password raised mid-session keeps the user known but blocks the app", () => {
		const s = sessionReducer(ready, { type: "mustChangePassword" });
		expect(s.status).toBe("must-change-password");
		expect(s.profile).toEqual(profile);
	});

	it("sessionEnded clears everything and records why", () => {
		const s = sessionReducer(ready, { type: "sessionEnded", reason: "tenant-mismatch" });
		expect(s.status).toBe("unauthenticated");
		expect(s.profile).toBeNull();
		expect(s.permissions).toBeNull();
		expect(s.endedReason).toBe("tenant-mismatch");
	});

	it("sessionEnded is idempotent: many failing requests report one end", () => {
		const once = sessionReducer(ready, { type: "sessionEnded", reason: "expired" });
		expect(sessionReducer(once, { type: "sessionEnded", reason: "invalid" })).toBe(once);
	});

	it("logout clears everything", () => {
		const s = sessionReducer(ready, { type: "loggedOut" });
		expect(s.status).toBe("unauthenticated");
		expect(s.permissions).toBeNull();
		expect(s.endedReason).toBe("logout");
	});
});
