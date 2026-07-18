import jwt                from "jsonwebtoken";
import crypto             from "crypto";
import { env }            from "../../config/env";
import { Role } from "../../generated/prisma";
/*
|--------------------------------------------------------------------------
| TOKEN SERVICE
| Handles: access tokens, refresh tokens, invite tokens, OTP generation
|--------------------------------------------------------------------------
*/

export interface AccessTokenPayload {
    id:       string;
    email:    string;
    role:     Role;
    schoolId: string | null;
}

export interface RefreshTokenPayload {
    id:      string;
    tokenId: string;   // matches RefreshToken.id in DB — for revocation
}

export interface TokenPair {
    accessToken:  string;
    refreshToken: string;
}

export class TokenService {

    // ── Access Token ─────────────────────────────────────────────────────
    generateAccessToken(payload: AccessTokenPayload): string {
        return jwt.sign(
            payload,
            env.jwt.accessSecret,
            { expiresIn: env.jwt.accessExpiresIn } as jwt.SignOptions,
        );
    }

    verifyAccessToken(token: string): AccessTokenPayload {
        return jwt.verify(
            token,
            env.jwt.accessSecret,
        ) as AccessTokenPayload;
    }

    // ── Refresh Token ────────────────────────────────────────────────────
    generateRefreshToken(payload: RefreshTokenPayload): string {
        return jwt.sign(
            payload,
            env.jwt.refreshSecret,
            { expiresIn: env.jwt.refreshExpiresIn } as jwt.SignOptions,
        );
    }

    verifyRefreshToken(token: string): RefreshTokenPayload {
        return jwt.verify(
            token,
            env.jwt.refreshSecret,
        ) as RefreshTokenPayload;
    }

    // ── Token Pair ───────────────────────────────────────────────────────
    generateTokenPair(
        user:    AccessTokenPayload,
        tokenId: string,
    ): TokenPair {
        return {
            accessToken:  this.generateAccessToken(user),
            refreshToken: this.generateRefreshToken({
                id:      user.id,
                tokenId,
            }),
        };
    }

    // ── Invite Token ─────────────────────────────────────────────────────
    // Cryptographically secure random token for invite links
    generateInviteToken(): string {
        return crypto.randomBytes(32).toString("hex");
    }

    // ── OTP ──────────────────────────────────────────────────────────────
    generateOtp(length = 6): string {
        const digits = "0123456789";
        let otp      = "";

        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * digits.length)];
        }

        return otp;
    }

    // ── OTP Expiry ───────────────────────────────────────────────────────
    getOtpExpiry(minutes = 10): Date {
        return new Date(Date.now() + minutes * 60 * 1000);
    }

    // ── Refresh Token Expiry ─────────────────────────────────────────────
    getRefreshTokenExpiry(): Date {
        const days = parseInt(env.jwt.refreshExpiresIn) || 7;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // ── Decode without verify ────────────────────────────────────────────
    // Useful for reading expired tokens during refresh flow
    decodeToken(token: string): any {
        return jwt.decode(token);
    }
}