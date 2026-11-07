import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPermissions } from "@schoolos/contracts";

vi.mock("@/features/auth/services/auth.api", () => ({ authApi: { login: vi.fn(), logout: vi.fn(), register: vi.fn() } }));
vi.mock("@/features/user/services/user.api", () => ({ userApi: { getMe: vi.fn(), getMyPermissions: vi.fn() } }));

import { authApi } from "@/features/auth/services/auth.api";
import { userApi } from "@/features/user/services/user.api";
import { ApiError, isApiError } from "@/lib/api/api-error";
import { queryClient } from "@/lib/api/query-client";
import { initialSessionState } from "@/lib/auth/session-reducer";
import type { Profile } from "@/lib/auth/session-types";
import { useAuthStore } from "@/stores/auth.store";

/*
| The store wires the pure reducer to the API. The API modules are replaced, so these tests prove the sequencing:
| one bootstrap, profile + permissions together, every login outcome, and a full reset on logout / session end.
*/

const profile: Profile = {
	id: "u1", email: "a@b.c", firstName: "Ada", lastName: "Obi", phone: null, photoUrl: null, isEmailVerified: true,
	lastLoginAt: null, createdAt: "2026-01-01T00:00:00.000Z",
	session: { kind: "school", schoolId: "s1", persona: "STAFF", impersonating: false },
};
const permissions: MyPermissions = {
	realm: "school", persona: "STAFF", roles: [], holdsEverything: false,
	permissions: [{ key: "students.view", scope: "ALL" }],
	branches: { all: [], assigned: [], schoolHasSeveral: false },
};
const authenticated = (mustChangePassword = false) => ({
	success: true as const, message: "ok",
	data: {
		status: "AUTHENTICATED" as const,
		user: { id: "u1", email: "a@b.c", isEmailVerified: true, mustChangePassword },
		session: { kind: "school" as const, schoolId: "s1", persona: "STAFF" as const },
	},
});

beforeEach(() => {
	useAuthStore.setState({ ...initialSessionState, user: null });
	queryClient.clear();
	vi.mocked(userApi.getMe).mockReset().mockResolvedValue(profile);
	vi.mocked(userApi.getMyPermissions).mockReset().mockResolvedValue(permissions);
	vi.mocked(authApi.login).mockReset();
	vi.mocked(authApi.logout).mockReset().mockResolvedValue({ success: true, message: "ok", data: null });
});

describe("bootstrap", () => {
	it("loads the profile and the permissions together and becomes ready", async () => {
		await useAuthStore.getState().bootstrap();
		const s = useAuthStore.getState();
		expect(s.status).toBe("ready");
		expect(s.profile).toEqual(profile);
		expect(s.user).toEqual(profile);
		expect(s.permissions).toEqual(permissions);
	});

	it("runs one request pair however many callers ask at once", async () => {
		await Promise.all([useAuthStore.getState().bootstrap(), useAuthStore.getState().bootstrap(), useAuthStore.getState().bootstrap()]);
		expect(vi.mocked(userApi.getMe).mock.calls.length).toBe(1);
		expect(vi.mocked(userApi.getMyPermissions).mock.calls.length).toBe(1);
	});

	it("never half-loads: if permissions fail, there is no profile either", async () => {
		vi.mocked(userApi.getMyPermissions).mockRejectedValue(new ApiError({ message: "no", status: 401, code: "TOKEN_MISSING" }));
		await useAuthStore.getState().bootstrap();
		const s = useAuthStore.getState();
		expect(s.status).toBe("unauthenticated");
		expect(s.profile).toBeNull();
		expect(s.permissions).toBeNull();
	});

	it("goes to must-change-password when the API demands it", async () => {
		vi.mocked(userApi.getMe).mockRejectedValue(new ApiError({ message: "change it", status: 403, code: "MUST_CHANGE_PASSWORD" }));
		await useAuthStore.getState().bootstrap();
		expect(useAuthStore.getState().status).toBe("must-change-password");
	});
});

describe("login", () => {
	it("an AUTHENTICATED result bootstraps once and ends ready", async () => {
		vi.mocked(authApi.login).mockResolvedValue(authenticated());
		const outcome = await useAuthStore.getState().login("a@b.c", "pw");
		expect(outcome).toEqual({ status: "ready" });
		expect(useAuthStore.getState().status).toBe("ready");
		expect(vi.mocked(userApi.getMe).mock.calls.length).toBe(1);
	});

	it("a persona selection stops in 'selecting' without loading a session", async () => {
		vi.mocked(authApi.login).mockResolvedValue({ success: true, message: "ok", data: { status: "PERSONA_SELECTION_REQUIRED", personas: ["STAFF", "GUARDIAN"] } });
		const outcome = await useAuthStore.getState().login("a@b.c", "pw");
		expect(outcome).toEqual({ status: "selecting" });
		const s = useAuthStore.getState();
		expect(s.status).toBe("selecting");
		expect(s.selection).toEqual({ kind: "persona", personas: ["STAFF", "GUARDIAN"] });
		expect(vi.mocked(userApi.getMe).mock.calls.length).toBe(0);
	});

	it("a school selection carries the school list", async () => {
		const schools = [{ id: "s1", name: "Greenfield", url: "https://greenfield.example.test" }];
		vi.mocked(authApi.login).mockResolvedValue({ success: true, message: "ok", data: { status: "SCHOOL_SELECTION_REQUIRED", schools } });
		await useAuthStore.getState().login("a@b.c", "pw");
		expect(useAuthStore.getState().selection).toEqual({ kind: "school", schools });
	});

	it("sends the chosen persona with the same credentials on the second step", async () => {
		vi.mocked(authApi.login).mockResolvedValue(authenticated());
		await useAuthStore.getState().login("a@b.c", "pw", "GUARDIAN");
		expect(vi.mocked(authApi.login).mock.calls[0][0]).toEqual({ email: "a@b.c", password: "pw", persona: "GUARDIAN" });
	});

	it("a login that requires a password change skips the bootstrap", async () => {
		vi.mocked(authApi.login).mockResolvedValue(authenticated(true));
		const outcome = await useAuthStore.getState().login("a@b.c", "pw");
		expect(outcome).toEqual({ status: "must-change-password" });
		expect(vi.mocked(userApi.getMe).mock.calls.length).toBe(0);
	});

	it("a failed login throws an ApiError carrying the server's code", async () => {
		vi.mocked(authApi.login).mockResolvedValue({ success: false, message: "Verify your email", code: "EMAIL_NOT_VERIFIED" });
		let caught: unknown;
		try {
			await useAuthStore.getState().login("a@b.c", "pw");
		} catch (e) {
			caught = e;
		}
		expect(isApiError(caught)).toBe(true);
		expect((caught as ApiError).code).toBe("EMAIL_NOT_VERIFIED");
		expect(useAuthStore.getState().status).not.toBe("ready");
	});

	it("signing in clears data cached for a previous session", async () => {
		queryClient.setQueryData(["students"], [{ id: "x" }]);
		vi.mocked(authApi.login).mockResolvedValue(authenticated());
		await useAuthStore.getState().login("a@b.c", "pw");
		expect(queryClient.getQueryData(["students"])).toBeUndefined();
	});
});

describe("logout and session end", () => {
	async function signedIn() {
		vi.mocked(authApi.login).mockResolvedValue(authenticated());
		await useAuthStore.getState().login("a@b.c", "pw");
		queryClient.setQueryData(["students"], [{ id: "x" }]);
	}

	it("logout calls the API once, then clears the session and every cached query", async () => {
		await signedIn();
		await useAuthStore.getState().logout();
		const s = useAuthStore.getState();
		expect(vi.mocked(authApi.logout).mock.calls.length).toBe(1);
		expect(s.status).toBe("unauthenticated");
		expect(s.profile).toBeNull();
		expect(s.user).toBeNull();
		expect(s.permissions).toBeNull();
		expect(queryClient.getQueryData(["students"])).toBeUndefined();
	});

	it("endSession clears the session and the cache, and is harmless when repeated", async () => {
		await signedIn();
		useAuthStore.getState().endSession("expired");
		useAuthStore.getState().endSession("expired");
		const s = useAuthStore.getState();
		expect(s.status).toBe("unauthenticated");
		expect(s.endedReason).toBe("expired");
		expect(queryClient.getQueryData(["students"])).toBeUndefined();
	});

	it("persists nothing to browser storage", async () => {
		await signedIn();
		expect(typeof localStorage === "undefined" || localStorage.length === 0).toBe(true);
	});
});
