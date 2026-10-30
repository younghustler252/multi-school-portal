import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { TokenService }            from "../../../shared/services/token.service";
import { TokenHashService }        from "../services/token-hash.service";
import { AuthAuditService }        from "../services/auth-audit.service";
import { RequestMeta }             from "../types/auth.types";

interface Dependencies {
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
    tokenHashService:       TokenHashService;
    authAuditService:       AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| LOGOUT
| Needs no access token (it may already be expired): the refresh token itself
| proves which session to end. Ends the whole rotation family of this device.
| Never throws for an unknown or invalid token.
|--------------------------------------------------------------------------
*/
export class LogoutUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(refreshToken: string | undefined, meta: RequestMeta): Promise<void> {
        if (!refreshToken) return;

        // decode (not verify): an expired token must still be able to log out
        const decoded = this.d.tokenService.decodeToken(refreshToken) as { tokenId?: string } | null;
        if (!decoded?.tokenId) return;

        const row = await this.d.refreshTokenRepository.findById(decoded.tokenId);
        if (!row) return;
        if (!this.d.tokenHashService.safeEqual(row.token, this.d.tokenHashService.hashToken(refreshToken))) return;

        await this.d.refreshTokenRepository.revokeFamily(row.familyId);
        await this.d.authAuditService.record({
            action: "auth.logout", userId: row.userId, schoolId: row.schoolId,
            ip: meta.ip, userAgent: meta.userAgent,
        });
    }

    async executeAll(userId: string, schoolId: string | null, meta: RequestMeta): Promise<void> {
        await this.d.refreshTokenRepository.revokeAllForUser(userId);
        await this.d.authAuditService.record({
            action: "auth.logout_all", userId, schoolId, ip: meta.ip, userAgent: meta.userAgent,
        });
    }
}
