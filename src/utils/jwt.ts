import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { UserRole } from "../types/UserRole";
import { Response } from "express";

/**
 * Strongly-typed JWT payload for access tokens
 */
export interface AccessTokenPayload extends JwtPayload {
    sub: string;       // user id
    tenantId: string;  // school / tenant id
    role: UserRole;    // student / teacher / admin
}

/**
 * Reuse library-defined expiresIn type
 */
type ExpiresIn = SignOptions["expiresIn"];

/**
 * Token TTLs (correctly typed)
 */
const ACCESS_TOKEN_TTL: ExpiresIn = "15m";
const REFRESH_TOKEN_TTL: ExpiresIn = "30d";

/**
 * Secrets (fail fast on misconfiguration)
 */
const getAccessSecret = (): string => {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        throw new Error("JWT_ACCESS_SECRET is not defined");
    }
    return secret;
};

const getRefreshSecret = (): string => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
        throw new Error("JWT_REFRESH_SECRET is not defined");
    }
    return secret;
};

/**
 * Sign an access token
 */
export const signAccessToken = (
    payload: AccessTokenPayload,
    expiresIn: ExpiresIn = ACCESS_TOKEN_TTL
): string => {
    return jwt.sign(payload, getAccessSecret(), { expiresIn });
};

/**
 * Sign a refresh token
 * Optional tenantId for multi-tenant awareness
 */
export const signRefreshToken = (
    userId: string,
    tenantId?: string,
    expiresIn: ExpiresIn = REFRESH_TOKEN_TTL
): string => {
    const payload: { sub: string; tenantId?: string } = { sub: userId };

    if (tenantId) {
        payload.tenantId = tenantId;
    }

    return jwt.sign(payload, getRefreshSecret(), { expiresIn });
};

/**
 * Verify an access token
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
    try {
        return jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
    } catch {
        throw new Error("Invalid or expired access token");
    }
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (
    token: string
): { sub: string; tenantId?: string } => {
    try {
        return jwt.verify(token, getRefreshSecret()) as {
            sub: string;
            tenantId?: string;
        };
    } catch {
        throw new Error("Invalid or expired refresh token");
    }
};

/**
 * Set refresh token in cookie (secure HTTP-only storage)
 */
export const setRefreshTokenCookie = (
    res: Response,
    userId: string,
    tenantId?: string
): void => {
    const refreshToken = signRefreshToken(userId, tenantId);

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
};
