import type { MyPermissions } from "@schoolos/contracts";
import type { EndReason, Profile, Selection, SessionState } from "./session-types";

/*
| The session state machine (AUTH-002 / AUTH-003). Pure: no network, no React, no storage.
|
|   loading ──bootstrapSucceeded──▶ ready
|   loading ──bootstrapRejected───▶ unauthenticated
|   loading ──mustChangePassword──▶ must-change-password
|   unauthenticated ──selectionRequired──▶ selecting ──selectionCancelled──▶ unauthenticated
|   (any) ──loginAuthenticated──▶ loading            (then a bootstrap runs)
|   (any) ──loginMustChangePassword──▶ must-change-password
|   must-change-password ──passwordChanged──▶ loading
|   (any) ──sessionEnded / loggedOut──▶ unauthenticated
|
| `ready` is the only state in which profile AND permissions both exist, and they always arrive together.
*/

export type SessionEvent =
	| { type: "bootstrapSucceeded"; profile: Profile; permissions: MyPermissions }
	| { type: "bootstrapRejected" }
	| { type: "mustChangePassword" }
	| { type: "loginAuthenticated" }
	| { type: "loginMustChangePassword" }
	| { type: "selectionRequired"; selection: Selection }
	| { type: "selectionCancelled" }
	| { type: "passwordChanged" }
	| { type: "sessionEnded"; reason: EndReason }
	| { type: "loggedOut" };

export const initialSessionState: SessionState = {
	status: "loading",
	profile: null,
	permissions: null,
	selection: null,
	endedReason: null,
};

const signedOut = (reason: EndReason | null): SessionState => ({
	status: "unauthenticated",
	profile: null,
	permissions: null,
	selection: null,
	endedReason: reason,
});

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
	switch (event.type) {
		case "bootstrapSucceeded":
			// A late bootstrap must not resurrect a session that ended (or never began) while it was in flight.
			if (state.status !== "loading") return state;
			return { status: "ready", profile: event.profile, permissions: event.permissions, selection: null, endedReason: null };

		case "bootstrapRejected":
			if (state.status !== "loading") return state;
			return signedOut(null);

		case "mustChangePassword":
			// Raised by the API client on any call; keep the profile if we already have one.
			if (state.status === "unauthenticated" || state.status === "must-change-password") return state;
			return { ...state, status: "must-change-password", selection: null, endedReason: null };

		case "loginAuthenticated":
			return { status: "loading", profile: null, permissions: null, selection: null, endedReason: null };

		case "loginMustChangePassword":
			return { status: "must-change-password", profile: null, permissions: null, selection: null, endedReason: null };

		case "selectionRequired":
			return { status: "selecting", profile: null, permissions: null, selection: event.selection, endedReason: null };

		case "selectionCancelled":
			return state.status === "selecting" ? signedOut(null) : state;

		case "passwordChanged":
			return state.status === "must-change-password"
				? { status: "loading", profile: null, permissions: null, selection: null, endedReason: null }
				: state;

		case "sessionEnded":
			// Idempotent: many in-flight requests can report the same dead session.
			if (state.status === "unauthenticated") return state;
			return signedOut(event.reason);

		case "loggedOut":
			return signedOut("logout");
	}
}
