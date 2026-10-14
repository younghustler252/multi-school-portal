import { IUserRepository }         from "../../auth/repositories/user.repository";
import { IRefreshTokenRepository } from "../../../usernew/user-module-v1/modules/auth/repositories/refresh-token.repository";
import { PasswordService }         from "../../../shared/services/password.service";
import { UserMapper }              from "../../auth/mappers/user.mapper";
import { AuthPolicyService }       from "../../auth/services/auth-policy.service";
import { AuthSessionService }      from "../../auth/services/auth-session.service";
import { LoginAttemptService }     from "../../auth/services/login-attempt.service";
import { MembershipService }       from "../../auth/services/membership.service";
import { AuthMessageService }      from "../../auth/services/auth-message.service";
import { AuthAuditService }        from "../../auth/services/auth-audit.service";
import { AuthenticatedResult, SessionInfo } from "../../auth/types/auth.types";
import { userErrors }              from "../domain/user.errors";
import { UserActionContext }       from "../domain/user.types";
import { ChangePasswordDtoType }   from "../dtos/user.dto";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    passwordService:        PasswordService;
    userMapper:             UserMapper;
    authPolicyService:      AuthPolicyService;
    authSessionService:     AuthSessionService;
    loginAttemptService:    LoginAttemptService;
    membershipService:      MembershipService;
    authMessageService:     AuthMessageService;
    authAuditService:       AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD (signed-in user)
| - not allowed while impersonating
| - the current-password check is rate limited like a login (a stolen session
|   must not become a password-guessing oracle)
| - new password follows the school's policy (security.password_min_length)
| - every session is revoked, then a FRESH session is issued for this device with
|   mustChangePassword cleared. This is what lets a user who was forced to change
|   their password continue without a second login.
|--------------------------------------------------------------------------
*/
export class ChangePasswordUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(ctx: UserActionContext, dto: ChangePasswordDtoType): Promise<AuthenticatedResult> {
        const d = this.d;
        if (ctx.impersonatedBy) throw userErrors.notWhileImpersonating();

        const user = await d.userRepository.findById(ctx.userId);
        if (!user) throw userErrors.notFound();
        const full = await d.userRepository.findByEmailWithPassword(user.email);
        if (!full) throw userErrors.notFound();

        await d.loginAttemptService.assertNotBlocked(user.email, ctx.ip);
        if (!(await d.passwordService.compare(dto.currentPassword, full.passwordHash))) {
            await d.loginAttemptService.recordFailure(user.email, ctx.ip);
            throw userErrors.currentPasswordIncorrect();
        }
        await d.loginAttemptService.clear(user.email, ctx.ip);

        if (await d.passwordService.compare(dto.newPassword, full.passwordHash)) throw userErrors.samePassword();
        await d.authPolicyService.assertPasswordAllowed(dto.newPassword, !!ctx.schoolId);

        const updated = await d.userRepository.update(ctx.userId, {
            passwordHash:       await d.passwordService.hash(dto.newPassword),
            passwordChangedAt:  new Date(),
            mustChangePassword: false,
            failedLoginCount:   0,
            lockedUntil:        null,
        });

        await d.refreshTokenRepository.revokeAllForUser(ctx.userId);

        // Fresh session for this device, same school and membership
        let session: SessionInfo = { kind: "platform", schoolId: null, membershipId: ctx.membershipId, persona: null };
        if (ctx.schoolId) {
            const m = ctx.membershipId ? await d.membershipService.findById(ctx.membershipId) : null;
            session = { kind: "school", schoolId: ctx.schoolId, membershipId: m?.id ?? null, persona: m?.persona ?? null };
        }
        const tokens = await d.authSessionService.issue({
            userId: ctx.userId, schoolId: session.schoolId, membershipId: session.membershipId,
            mustChangePassword: false, ip: ctx.ip, userAgent: ctx.userAgent,
        });

        await d.authAuditService.record({
            action: "user.password_changed", module: "user", userId: ctx.userId, schoolId: ctx.schoolId,
            actorMembershipId: ctx.membershipId, entity: "User", entityId: ctx.userId,
            ip: ctx.ip, userAgent: ctx.userAgent, metadata: { otherSessionsRevoked: true },
        });
        d.authMessageService.sendEmailSafely("auth.password_changed", user.email, {
            "recipient.firstName": user.firstName ?? undefined,
        });

        return { status: "AUTHENTICATED", user: d.userMapper.toResponse(updated), session, tokens };
    }
}
