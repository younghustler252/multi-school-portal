import { Role, OtpType } from "../../../generated/prisma/enums";
/*
|--------------------------------------------------------------------------
| AUTH DOMAIN ENTITIES
| Clean domain objects — no Prisma types, no sensitive fields leaked
|--------------------------------------------------------------------------
*/

// ── User Entity ──────────────────────────────────────────────────────────
export interface UserEntity {
    id:               string;
    schoolId:         string | null;
    email:            string;
    role:             Role;
    firstName:        string | null;
    lastName:         string | null;
    phone:            string | null;
    photoUrl:         string | null;
    isActive:         boolean;
    isEmailVerified:  boolean;
    emailVerifiedAt:  Date | null;
    lastLoginAt:      Date | null;
    lastLoginIp:      string | null;
    failedLoginCount: number;
    lockedUntil:      Date | null;
    passwordChangedAt: Date | null;
    createdAt:        Date;
    updatedAt:        Date;
}

// ── OTP Entity ───────────────────────────────────────────────────────────
export interface OtpEntity {
    id:        string;
    userId:    string;
    code:      string;
    type:      OtpType;
    expiresAt: Date;
    usedAt:    Date | null;
    attempts:  number;
    createdAt: Date;
}

// ── Refresh Token Entity ─────────────────────────────────────────────────
export interface RefreshTokenEntity {
    id:        string;
    userId:    string;
    token:     string;
    expiresAt: Date;
    createdAt: Date;
}

// ── Invite Entity ────────────────────────────────────────────────────────
export interface InviteEntity {
    id:        string;
    email:     string;
    role:      Role;
    token:     string;
    schoolId:  string;
    sentById:  string;
    accepted:  boolean;
    expiresAt: Date;
    createdAt: Date;
}