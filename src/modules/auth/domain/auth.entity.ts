import { OtpType } from "../../../generated/public/client";

/*
|--------------------------------------------------------------------------
| AUTH DOMAIN ENTITIES
| No Prisma types leak out; no role or school on the user (authority lives in
| tenant Membership; UserSchool is only a discovery index).
|--------------------------------------------------------------------------
*/

export interface UserEntity {
    id:                 string;
    email:              string;
    firstName:          string | null;
    lastName:           string | null;
    phone:              string | null;
    photoUrl:           string | null;
    isActive:           boolean;
    isEmailVerified:    boolean;
    emailVerifiedAt:    Date | null;
    lastLoginAt:        Date | null;
    lastLoginIp:        string | null;
    failedLoginCount:   number;
    lockedUntil:        Date | null;
    passwordChangedAt:  Date | null;
    mustChangePassword: boolean;
    createdAt:          Date;
    updatedAt:          Date;
}

// `code` holds an HMAC of the code, never the code itself
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

// `token` holds an HMAC of the refresh JWT, never the JWT itself
export interface RefreshTokenEntity {
    id:             string;
    userId:         string;
    token:          string;
    familyId:       string;
    schoolId:       string | null;
    membershipId:   string | null;
    impersonatorId: string | null;
    userAgent:      string | null;
    ipAddress:      string | null;
    lastUsedAt:     Date | null;
    revokedAt:      Date | null;
    replacedById:   string | null;
    expiresAt:      Date;
    createdAt:      Date;
}

// `token` holds an HMAC of the invite token
export interface InviteEntity {
    id:              string;
    email:           string;
    token:           string;
    schoolId:        string;
    sentById:        string;
    persona:         "STAFF" | "STUDENT" | "GUARDIAN";
    roleId:          string | null;
    personaEntityId: string | null;
    accepted:        boolean;
    acceptedAt:      Date | null;
    revokedAt:       Date | null;
    expiresAt:       Date;
    createdAt:       Date;
}
