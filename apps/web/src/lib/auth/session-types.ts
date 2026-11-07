import type { MyPermissions } from "@schoolos/contracts";

/*
| Web-local auth/session types (AUTH-001). They mirror apps/api/src/modules/auth/types/auth.types.ts and
| modules/user/mappers/user.mapper.ts. They stay here until the API's parity tests cover response shapes (see baseline §5).
*/

export type Persona = "STAFF" | "STUDENT" | "GUARDIAN";

export interface SessionInfo {
	kind: "school" | "platform";
	schoolId: string | null;
	membershipId?: string | null;
	persona: Persona | null;
	impersonating?: boolean;
}

/** GET /users/me */
export interface Profile {
	id: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	phone: string | null;
	photoUrl: string | null;
	isEmailVerified: boolean;
	lastLoginAt: string | null;
	createdAt: string;
	session: { kind: "school" | "platform"; schoolId: string | null; persona: Persona | null; impersonating: boolean };
}

export interface SchoolChoice {
	id: string;
	name: string;
	url: string;
}

/** POST /auth/login. Only AUTHENTICATED sets cookies; the other two are questions the user must answer. */
export type LoginResult =
	| {
			status: "AUTHENTICATED";
			user: { id: string; email: string; isEmailVerified: boolean; mustChangePassword: boolean };
			session: SessionInfo;
	  }
	| { status: "PERSONA_SELECTION_REQUIRED"; personas: Persona[] }
	| { status: "SCHOOL_SELECTION_REQUIRED"; schools: SchoolChoice[] };

export type Selection =
	| { kind: "persona"; personas: Persona[] }
	| { kind: "school"; schools: SchoolChoice[] };

export type SessionStatus = "loading" | "unauthenticated" | "selecting" | "must-change-password" | "ready";

export type EndReason = "expired" | "invalid" | "tenant-mismatch" | "logout";

export interface SessionState {
	status: SessionStatus;
	profile: Profile | null;
	permissions: MyPermissions | null;
	selection: Selection | null;
	endedReason: EndReason | null;
}
