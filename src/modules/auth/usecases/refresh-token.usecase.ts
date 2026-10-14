import { IUserRepository }         from "../repositories/user.repository";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { TokenService }            from "../../../shared/services/token.service";
import { UserMapper }              from "../mappers/user.mapper";
import { AuthSessionService }      from "../services/auth-session.service";
import { TokenHashService }        from "../services/token-hash.service";
import { MembershipService }       from "../services/membership.service";
import { AuthAuditService }        from "../services/auth-audit.service";
import { authErrors }              from "../domain/auth.errors";
import { REFRESH_REUSE_GRACE_SECONDS } from "../domain/auth.enums";
import { AuthenticatedResult, RequestMeta, SessionInfo } from "../types/auth.types";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
    tokenHashService:       TokenHashService;
    authSessionService:     AuthSessionService;
    membershipService:      MembershipService;
    authAuditService:       AuthAuditService;
    userMapper:             UserMapper;
}

/*
|--------------------------------------------------------------------------
| REFRESH (rotation with reuse detection)
| - the presented JWT must verify AND match the stored HMAC of its row
| - a row that was already rotated is a REUSE: the whole family is revoked
|   (a short grace window instead answers REFRESH_IN_PROGRESS so two tabs
|   refreshing at once do not log the user out)
| - the session is re-validated against the host school and the CURRENT
|   membership / platform member status, not just the old token
| - exactly one caller can claim a row (atomic), then a new row is created in
|   the same family; impersonation sessions keep their original absolute expiry
|--------------------------------------------------------------------------
*/

export class RefreshTokenUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(refreshToken: string | undefined, hostSchoolId: string | null, meta: RequestMeta): Promise<AuthenticatedResult> {
        const d = this.d;
        if (!refreshToken) throw authErrors.refreshInvalid();

        let payload;
        try { payload = d.tokenService.verifyRefreshToken(refreshToken); }
        catch { throw authErrors.refreshInvalid(); }

        const row = await d.refreshTokenRepository.findById(payload.tokenId);
        if (
            !row || row.userId !== payload.id ||
            !d.tokenHashService.safeEqual(row.token, d.tokenHashService.hashToken(refreshToken))
        ) throw authErrors.refreshInvalid();

        if (row.expiresAt < new Date()) throw authErrors.refreshInvalid();

        // ── Reuse detection ──────────────────────────────────────────────
        if (row.revokedAt) {
            if (Date.now() - row.revokedAt.getTime() < REFRESH_REUSE_GRACE_SECONDS * 1000) {
                throw authErrors.refreshInProgress();
            }
            await d.refreshTokenRepository.revokeFamily(row.familyId);
            await d.authAuditService.record({
                action: "auth.refresh_reuse_detected", userId: row.userId, schoolId: row.schoolId,
                ip: meta.ip, userAgent: meta.userAgent, metadata: { familyId: row.familyId },
            });
            throw authErrors.refreshReused();
        }

        const user = await d.userRepository.findById(row.userId);
        if (!user || !user.isActive) {
            await d.refreshTokenRepository.revokeFamily(row.familyId);
            throw authErrors.refreshInvalid();
        }

        // ── Re-validate the session's context ────────────────────────────
        let session: SessionInfo;
        if (row.schoolId) {
            if (!hostSchoolId || hostSchoolId !== row.schoolId) throw authErrors.tenantMismatch();
            const m = row.membershipId ? await d.membershipService.findById(row.membershipId) : null;
            if (!m || m.userId !== user.id || m.status !== "active") {
                await d.refreshTokenRepository.revokeFamily(row.familyId);
                throw authErrors.refreshInvalid();
            }
            session = { kind: "school", schoolId: row.schoolId, membershipId: m.id, persona: m.persona };
        } else {
            if (hostSchoolId) throw authErrors.tenantMismatch();
            const pm = await d.membershipService.getActivePlatformMember(user.id);
            if (!pm || pm.id !== row.membershipId) {
                await d.refreshTokenRepository.revokeFamily(row.familyId);
                throw authErrors.refreshInvalid();
            }
            session = { kind: "platform", schoolId: null, membershipId: pm.id, persona: null };
        }

        // ── Rotate ───────────────────────────────────────────────────────
        const newId = d.authSessionService.newTokenId();
        if (!(await d.refreshTokenRepository.revokeIfActive(row.id, newId))) throw authErrors.refreshInProgress();

        const tokens = await d.authSessionService.issue({
            userId: user.id, schoolId: session.schoolId, membershipId: session.membershipId,
            mustChangePassword: row.impersonatorId ? false : user.mustChangePassword,
            ip: meta.ip, userAgent: meta.userAgent,
            familyId: row.familyId, tokenId: newId, impersonatorId: row.impersonatorId,
            expiresAt: row.impersonatorId ? row.expiresAt : undefined,
        });

        return { status: "AUTHENTICATED", user: d.userMapper.toResponse(user), session, tokens };
    }
}
