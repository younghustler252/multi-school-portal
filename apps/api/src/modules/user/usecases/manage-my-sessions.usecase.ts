import { IRefreshTokenRepository } from "../../auth/repositories/refresh-token.repository";
import { TokenService }            from "../../../shared/services/token.service";
import { TokenHashService }        from "../../auth/services/token-hash.service";
import { AuthAuditService }        from "../../auth/services/auth-audit.service";
import { userErrors }              from "../domain/user.errors";
import { UserActionContext }       from "../domain/user.types";

interface Dependencies {
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
    tokenHashService:       TokenHashService;
    authAuditService:       AuthAuditService;
}

// Short readable device label from a user agent (display only, never used for security)
function deviceLabel(ua: string | null): string {
    if (!ua) return "Unknown device";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
                  : /Safari\//.test(ua) ? "Safari" : "Browser";
    const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS"
             : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
    return `${browser} on ${os}`;
}

/*
| MY SESSIONS: the signed-in devices of the caller. A session's id is its refresh-token family
| (stable across rotations). Impersonation sessions are never shown to or revocable by the user.
| Only the caller's own sessions can be listed or revoked.
*/
export class ManageMySessionsUseCase {
    constructor(private readonly d: Dependencies) {}

    private async currentFamily(userId: string, refreshToken?: string): Promise<string | null> {
        if (!refreshToken) return null;
        const decoded = this.d.tokenService.decodeToken(refreshToken) as { tokenId?: string } | null;
        if (!decoded?.tokenId) return null;
        const row = await this.d.refreshTokenRepository.findById(decoded.tokenId);
        if (!row || row.userId !== userId) return null;
        return this.d.tokenHashService.safeEqual(row.token, this.d.tokenHashService.hashToken(refreshToken)) ? row.familyId : null;
    }

    async list(ctx: UserActionContext, refreshToken?: string) {
        const rows    = await this.d.refreshTokenRepository.listActiveForUser(ctx.userId);
        const current = await this.currentFamily(ctx.userId, refreshToken);
        return rows
            .filter(r => !r.impersonatorId)
            .map(r => ({
                id:           r.familyId,
                device:       deviceLabel(r.userAgent),
                ipAddress:    r.ipAddress,
                schoolId:     r.schoolId,
                lastActiveAt: r.createdAt,      // the active row is created at each rotation
                current:      r.familyId === current,
            }));
    }

    /** Returns whether the revoked session was the caller's own current one (the controller then clears cookies). */
    async revoke(ctx: UserActionContext, familyId: string, refreshToken?: string): Promise<{ wasCurrent: boolean }> {
        const rows = await this.d.refreshTokenRepository.listActiveForUser(ctx.userId);
        if (!rows.some(r => r.familyId === familyId && !r.impersonatorId)) throw userErrors.sessionNotFound();

        const current = await this.currentFamily(ctx.userId, refreshToken);
        await this.d.refreshTokenRepository.revokeFamily(familyId);
        await this.d.authAuditService.record({
            action: "user.session_revoked", module: "user", userId: ctx.userId, schoolId: ctx.schoolId,
            actorMembershipId: ctx.membershipId, entity: "Session", entityId: familyId,
            ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return { wasCurrent: familyId === current };
    }
}
