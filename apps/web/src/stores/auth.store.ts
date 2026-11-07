import { create } from "zustand";
import { authApi } from "@/features/auth/services/auth.api";
import { userApi } from "@/features/user/services/user.api";
import type { RegisterDto, RegisterResponseData } from "@/features/auth/types/auth.types";
import { API_CODES, isApiError, normalizeApiError } from "@/lib/api/api-error";
import { registerSessionHandlers } from "@/lib/api/session-events";
import { queryClient } from "@/lib/api/query-client";
import { initialSessionState, sessionReducer, type SessionEvent } from "@/lib/auth/session-reducer";
import type { EndReason, Persona, Profile, SessionState } from "@/lib/auth/session-types";

/*
| The one place session state lives (AUTH-002 / AUTH-003).
|
| - Nothing is persisted: not the profile, not tokens, not a "logged in" flag. The HttpOnly cookies are the session;
|   the browser asks the API who it is on every load (bootstrap).
| - `ready` means profile AND permissions were both loaded; they are never set separately.
| - Every transition goes through sessionReducer, so the rules are testable without React or the network.
*/

export type LoginOutcome = { status: "ready" } | { status: "selecting" } | { status: "must-change-password" };

interface AuthState extends SessionState {
	/** Same object as `profile`, kept so existing `useAuthStore((s) => s.user)` call sites keep working. */
	user: Profile | null;

	login: (email: string, password: string, persona?: Persona) => Promise<LoginOutcome>;
	/** Loads /users/me and /users/me/permissions together. Safe to call from several places: one request runs. */
	bootstrap: () => Promise<void>;
	cancelSelection: () => void;
	logout: () => Promise<void>;
	endSession: (reason: EndReason) => void;
	markMustChangePassword: () => void;
	/** After a successful password change: reload the session (the old token still carries the old claim, so the API may ask to log in again). */
	passwordChanged: () => Promise<void>;
	register: (data: RegisterDto) => Promise<RegisterResponseData>;
	/** Compatibility for call sites that refresh the profile after editing it. */
	fetchCurrentUser: () => Promise<boolean>;
}

let bootstrapInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => {
	const dispatch = (event: SessionEvent) =>
		set((state) => {
			const next = sessionReducer(state, event);
			return next === state ? state : { ...next, user: next.profile };
		});

	// A different person may sign in next on this browser: nothing fetched for the old session may survive.
	const resetData = () => queryClient.clear();

	async function bootstrap(): Promise<void> {
		if (bootstrapInFlight) return bootstrapInFlight;
		bootstrapInFlight = (async () => {
			try {
				const [profile, permissions] = await Promise.all([userApi.getMe(), userApi.getMyPermissions()]);
				dispatch({ type: "bootstrapSucceeded", profile, permissions });
			} catch (err) {
				if (isApiError(err) && err.code === API_CODES.MUST_CHANGE_PASSWORD) dispatch({ type: "mustChangePassword" });
				else dispatch({ type: "bootstrapRejected" });
			} finally {
				bootstrapInFlight = null;
			}
		})();
		return bootstrapInFlight;
	}

	return {
		...initialSessionState,
		user: null,

		bootstrap,

		login: async (email, password, persona) => {
			const res = await authApi.login({ email, password, ...(persona ? { persona } : {}) });
			if (!res.success) {
				throw normalizeApiError(null, { message: res.message, code: res.code, errors: res.errors });
			}
			const result = res.data;

			if (result.status === "PERSONA_SELECTION_REQUIRED") {
				dispatch({ type: "selectionRequired", selection: { kind: "persona", personas: result.personas } });
				return { status: "selecting" };
			}
			if (result.status === "SCHOOL_SELECTION_REQUIRED") {
				dispatch({ type: "selectionRequired", selection: { kind: "school", schools: result.schools } });
				return { status: "selecting" };
			}

			resetData();
			if (result.user.mustChangePassword) {
				dispatch({ type: "loginMustChangePassword" });
				return { status: "must-change-password" };
			}
			dispatch({ type: "loginAuthenticated" });
			await bootstrap();
			const after = get().status;
			if (after === "ready") return { status: "ready" };
			if (after === "must-change-password") return { status: "must-change-password" };
			// Login said yes but the session could not be read back (cookies not stored or not sent: see the origin notes in the baseline).
			throw normalizeApiError(null, { message: "You are signed in, but your session could not be loaded. Please try again.", code: API_CODES.SESSION_INVALID });
		},

		cancelSelection: () => dispatch({ type: "selectionCancelled" }),

		logout: async () => {
			// Ask the API to end the refresh family and clear the cookies; reset locally whatever the answer is.
			await authApi.logout();
			dispatch({ type: "loggedOut" });
			resetData();
		},

		endSession: (reason) => {
			if (get().status === "unauthenticated") return;
			dispatch({ type: "sessionEnded", reason });
			resetData();
		},

		markMustChangePassword: () => dispatch({ type: "mustChangePassword" }),

		passwordChanged: async () => {
			dispatch({ type: "passwordChanged" });
			await bootstrap();
		},

		register: async (data) => {
			const res = await authApi.register(data);
			if (!res.success) throw res;
			return res.data;
		},

		fetchCurrentUser: async () => {
			try {
				const profile = await userApi.getMe();
				set((state) => (state.status === "ready" ? { profile, user: profile } : state));
				return true;
			} catch (err) {
				void err;
				return false;
			}
		},
	};
});

registerSessionHandlers({
	onSessionEnded: (reason) => useAuthStore.getState().endSession(reason),
	onMustChangePassword: () => useAuthStore.getState().markMustChangePassword(),
});
