import jwt                from "jsonwebtoken";
import crypto             from "crypto";
import { env }            from "../../config/env";

/*
|--------------------------------------------------------------------------
| TOKEN SERVICE
| Handles: access tokens, refresh tokens, invite tokens, OTP generation
|--------------------------------------------------------------------------
*/

/**
 * Access token claims. Identity only: roles and permissions are NOT in the token,
 * they are loaded per request so a role change or deactivation applies immediately.
 */
export interface AccessTokenPayload {
    sub:  string;          // User.id
    tid:  string | null;   // school id this session is bound to; null = platform session
    mid:  string | null;   // tenant Membership.id (school session) or PlatformMember.id (platform session)
    mcp:  boolean;         // must change password
    imp?: string;          // User.id of the platform member who is impersonating (audit)
}

export interface RefreshTokenPayload {
    id:      string;
    tokenId: string;   // matches RefreshToken.id in DB — for revocation
}

export interface TokenPair {
    accessToken:  string;
    refreshToken: string;
}

const UNIT_MS: Record<string, number> = {
    ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000,
};

/**
 * Parses the same values jsonwebtoken accepts for `expiresIn`:
 * a number means seconds, "7d" / "12h" / "15m" / "30s" use the unit, a bare numeric string means milliseconds.
 */
export function parseDurationMs(input: string | number): number {
    if (typeof input === "number") return input * 1000;
    const match = /^\s*(\d+)\s*(ms|s|m|h|d|w)?\s*$/i.exec(input);
    if (!match) throw new Error(`Unsupported duration "${input}". Use values like 7d, 12h, 15m.`);
    return Number(match[1]) * UNIT_MS[(match[2] ?? "ms").toLowerCase()];
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
        const decoded = jwt.verify(token, env.jwt.accessSecret, { algorithms: ["HS256"] }) as Partial<AccessTokenPayload>;
        if (typeof decoded.sub !== "string") {
            throw new jwt.JsonWebTokenError("invalid claims");
        }
        return {
            sub: decoded.sub,
            tid: decoded.tid ?? null,
            mid: decoded.mid ?? null,
            mcp: decoded.mcp === true,
            ...(decoded.imp ? { imp: decoded.imp } : {}),
        };
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
            { algorithms: ["HS256"] }
        ) as RefreshTokenPayload;
    }

    // ── Token Pair ───────────────────────────────────────────────────────
    generateTokenPair(
        claims:  AccessTokenPayload,
        tokenId: string,
    ): TokenPair {
        return {
            accessToken:  this.generateAccessToken(claims),
            refreshToken: this.generateRefreshToken({
                id:      claims.sub,
                tokenId,
            }),
        };
    }

    // ── Invite Token ─────────────────────────────────────────────────────
    generateInviteToken(): string {
        return crypto.randomBytes(32).toString("hex");
    }

    // ── OTP ──────────────────────────────────────────────────────────────
    // crypto.randomInt is cryptographically secure (Math.random is not).
    generateOtp(length = 6): string {
        return crypto.randomInt(0, 10 ** length).toString().padStart(length, "0");
    }

    // ── OTP Expiry ───────────────────────────────────────────────────────
    getOtpExpiry(minutes = 10): Date {
        return new Date(Date.now() + minutes * 60 * 1000);
    }

    // ── Refresh Token Expiry ─────────────────────────────────────────────
    // Same parsing as the JWT's own expiry, so the DB row and the token always agree.
    getRefreshTokenExpiry(): Date {
        return new Date(Date.now() + parseDurationMs(env.jwt.refreshExpiresIn));
    }

    // ── Decode without verify ────────────────────────────────────────────
    decodeToken(token: string): any {
        return jwt.decode(token);
    }
}