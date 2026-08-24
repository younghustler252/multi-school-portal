import { UserEntity } from "../domain/auth.entity";

/*
|--------------------------------------------------------------------------
| AUTH MODULE TYPES
| Internal types used across the auth module
|--------------------------------------------------------------------------
*/

// ── Token pair returned after login/register ─────────────────────────────
export interface AuthTokens {
    accessToken:  string;
    refreshToken: string;
}

// ── Full auth response returned to client ────────────────────────────────
export interface AuthResponse {
    user:   UserResponseData;
    tokens: AuthTokens;
}

// ── Safe user data returned to client (no sensitive fields) ──────────────
export interface UserResponseData {
    id:             string;
    email:          string;
    role:           string;
    firstName:      string | null;
    lastName:       string | null;
    phone:          string | null;
    photoUrl:       string | null;
    schoolId:       string | null;
    isEmailVerified: boolean;
    mustChangePAssword: boolean;
}

// ── JWT payload shape ────────────────────────────────────────────────────
export interface JwtPayload {
    id:       string;
    email:    string;
    role:     string;
    schoolId: string | null;
}

// ── Internal use — user with password hash for auth checks ───────────────
export interface UserWithPassword extends UserEntity {
    passwordHash: string;
}