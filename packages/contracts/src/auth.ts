/*
| LOGIN RESULT: what POST /api/v1/auth/login returns in `data`, told apart by `status`.
| Only AUTHENTICATED carries tokens (also set as HttpOnly cookies). Every other status is a routing or choice step.
*/
export type PersonaType = "STAFF" | "GUARDIAN" | "STUDENT";

/** A school the person can really sign in to. `url` is the school's own address (its verified custom domain when it has one). */
export interface LoginSchoolRef { id: string; name: string; url: string }

export type LoginSession =
    | { kind: "school";   schoolId: string; membershipId: string; persona: PersonaType }
    | { kind: "platform"; schoolId: null;   membershipId: string; persona: null };

export type LoginResult =
    | { status: "AUTHENTICATED"; user: unknown; session: LoginSession; tokens: { accessToken: string; refreshToken: string } }
    /** On a school's address, the person holds several profiles there: ask which one, then repeat the login with `persona`. */
    | { status: "PERSONA_SELECTION_REQUIRED"; personas: PersonaType[] }
    /**
     * Platform address, exactly ONE school the person can enter. Go to `school.url` and sign in there (the person signs in
     * again on the school's address: no token or cookie is shared across addresses). Nothing is authenticated yet.
     */
    | { status: "SCHOOL_REDIRECT"; school: LoginSchoolRef }
    /** Platform address, SEVERAL schools: let the person choose. `suggestedSchoolId` (the last school used, if still allowed) is listed first. */
    | { status: "SCHOOL_SELECTION_REQUIRED"; schools: LoginSchoolRef[]; suggestedSchoolId: string | null };

/*
| Platform address, no school and no platform membership: 401 with the same generic "invalid credentials" message as a wrong
| password (we do not reveal which schools exist or who belongs where).
*/
