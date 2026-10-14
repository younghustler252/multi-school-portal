import { UserEntity } from "../domain/auth.entity";

export type PersonaType = "STAFF" | "STUDENT" | "GUARDIAN";

export interface RequestMeta {
    ip:        string;
    userAgent: string | null;
}

export interface AuthTokens {
    accessToken:  string;
    refreshToken: string;
}

export interface SessionInfo {
    kind:         "school" | "platform";
    schoolId:     string | null;
    membershipId: string | null;
    persona:      PersonaType | null;
}

export interface UserResponseData {
    id:                 string;
    email:              string;
    firstName:          string | null;
    lastName:           string | null;
    phone:              string | null;
    photoUrl:           string | null;
    isEmailVerified:    boolean;
    mustChangePassword: boolean;
}

export interface AuthenticatedResult {
    status:  "AUTHENTICATED";
    user:    UserResponseData;
    session: SessionInfo;
    tokens:  AuthTokens;
}

export type LoginResult =
    | AuthenticatedResult
    | { status: "PERSONA_SELECTION_REQUIRED"; personas: PersonaType[] }
    | { status: "SCHOOL_SELECTION_REQUIRED";  schools: { id: string; name: string; url: string }[] };

export interface UserWithPassword extends UserEntity {
    passwordHash: string;
}

// The acting staff member on invite routes
export interface InviteActor {
    userId:       string;
    membershipId: string | null;
    isAdmin:      boolean;
    can:          (permissionKey: string) => boolean;
}
