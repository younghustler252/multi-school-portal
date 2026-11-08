import type { LoginResult as ContractLoginResult, LoginSchoolRef, LoginSession, MyPermissions, PersonaType } from "@schoolos/contracts";

/*
| Auth/session types (AUTH-001). The login result comes from the shared contract (packages/contracts/src/auth.ts) so the
| web app cannot drift from the API; the profile shape mirrors modules/user/mappers/user.mapper.ts and stays web-local until
| the API's parity tests cover response shapes (see baseline §5).
*/

export type Persona = PersonaType;
export type SessionInfo = LoginSession;

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

/** A school the person can sign in to. `url` is the school's own address (verified custom domain when it has one). */
export type SchoolChoice = LoginSchoolRef;

/** The AUTHENTICATED `user` is `unknown` in the contract; the web app reads these fields from it. */
export interface LoginUser {
	id: string;
	email: string;
	isEmailVerified: boolean;
	mustChangePassword: boolean;
}

/*
| POST /auth/login: four outcomes, told apart by `status`. Only AUTHENTICATED creates a session (cookies).
| SCHOOL_REDIRECT and SCHOOL_SELECTION_REQUIRED are different things:
|   SCHOOL_REDIRECT            exactly ONE school: go to school.url, nothing to choose. Routing only, nothing is authenticated.
|   SCHOOL_SELECTION_REQUIRED  SEVERAL schools: the person chooses one, then goes to its url. Also routing only.
| In both, the person signs in again on the school's address; no token or cookie is shared across addresses.
*/
export type LoginResult =
	| (Extract<ContractLoginResult, { status: "AUTHENTICATED" }> & { user: LoginUser })
	| Exclude<ContractLoginResult, { status: "AUTHENTICATED" }>;

export type Selection =
	| { kind: "persona"; personas: Persona[] }
	| { kind: "school"; schools: SchoolChoice[]; suggestedSchoolId: string | null };

export type SessionStatus = "loading" | "unauthenticated" | "selecting" | "must-change-password" | "ready";

export type EndReason = "expired" | "invalid" | "tenant-mismatch" | "logout";

export interface SessionState {
	status: SessionStatus;
	profile: Profile | null;
	permissions: MyPermissions | null;
	selection: Selection | null;
	endedReason: EndReason | null;
}
