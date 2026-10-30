import { randomUUID } from "crypto";
import { TokenService, AccessTokenPayload } from "../../../shared/services/token.service";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { TokenHashService } from "./token-hash.service";
import { AuthTokens } from "../types/auth.types";

export interface IssueSessionParams {
    userId:             string;
    schoolId:           string | null;   // null = platform session
    membershipId:       string | null;   // tenant Membership.id or PlatformMember.id
    mustChangePassword: boolean;
    ip:                 string;
    userAgent:          string | null;
    familyId?:          string;          // keep the family when rotating
    tokenId?:           string;          // pre-generated id (rotation claims it first)
    impersonatorId?:    string | null;   // platform user id when impersonating
    expiresAt?:         Date;            // override (impersonation cap, inherited absolute expiry)
}

/*
|--------------------------------------------------------------------------
| AUTH SESSION SERVICE
| The single place that mints an access token + refresh token and persists the
| refresh row. The refresh row stores only the HMAC of the token, plus the
| school, membership and impersonator so a refresh can re-validate the exact
| session it came from.
|--------------------------------------------------------------------------
*/

export class AuthSessionService {
    private readonly tokens:  TokenService;
    private readonly refresh: IRefreshTokenRepository;
    private readonly hasher:  TokenHashService;

    constructor({ tokenService, refreshTokenRepository, tokenHashService }: {
        tokenService: TokenService;
        refreshTokenRepository: IRefreshTokenRepository;
        tokenHashService: TokenHashService;
    }) {
        this.tokens  = tokenService;
        this.refresh = refreshTokenRepository;
        this.hasher  = tokenHashService;
    }

    newTokenId(): string {
        return randomUUID();
    }

    async issue(p: IssueSessionParams): Promise<AuthTokens> {
        const tokenId = p.tokenId ?? this.newTokenId();

        const claims: AccessTokenPayload = {
            sub: p.userId,
            tid: p.schoolId,
            mid: p.membershipId,
            mcp: p.mustChangePassword,
            ...(p.impersonatorId ? { imp: p.impersonatorId } : {}),
        };

        const pair = this.tokens.generateTokenPair(claims, tokenId);

        await this.refresh.create({
            id:             tokenId,
            userId:         p.userId,
            token:          this.hasher.hashToken(pair.refreshToken),
            familyId:       p.familyId ?? tokenId,
            schoolId:       p.schoolId,
            membershipId:   p.membershipId,
            impersonatorId: p.impersonatorId ?? null,
            userAgent:      p.userAgent ? p.userAgent.slice(0, 255) : null,
            ipAddress:      p.ip,
            expiresAt:      p.expiresAt ?? this.tokens.getRefreshTokenExpiry(),
        });

        return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
    }
}
