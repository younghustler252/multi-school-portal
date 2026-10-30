import { redisConnection }    from "../../../infrastructure/jobs/connection";
import { IUserRepository }    from "../repositories/user.repository";
import { UserMapper }         from "../mappers/user.mapper";
import { AuthSessionService } from "../services/auth-session.service";
import { MembershipService }  from "../services/membership.service";
import { AuthAuditService }   from "../services/auth-audit.service";
import { authErrors }         from "../domain/auth.errors";
import { IMPERSONATION_MAX_MINUTES } from "../domain/auth.enums";
import { AuthenticatedResult, RequestMeta } from "../types/auth.types";

interface Dependencies {
    userRepository:     IUserRepository;
    userMapper:         UserMapper;
    authSessionService: AuthSessionService;
    membershipService:  MembershipService;
    authAuditService:   AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| EXCHANGE IMPERSONATION TICKET (platform user -> school session)
| The ticket is created by the platform's audited impersonation use case and is
| stored in Redis as JSON: { userId, schoolId, impersonatorId, membershipId? }
| (impersonatorId = User.id of the platform member; REQUIRED, tickets without it
| are rejected). Here:
|  - the ticket is read AND deleted in one atomic step (GETDEL, Redis >= 6.2)
|  - it must be for THIS school host, and the impersonator must still be an active platform member
|  - the resulting session carries `imp`, never forces a password change, and its
|    refresh chain cannot outlive IMPERSONATION_MAX_MINUTES
|  - the start of the session is audited against the platform member
|--------------------------------------------------------------------------
*/
export class ExchangeImpersonationTokenUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(ticket: string, hostSchoolId: string, meta: RequestMeta): Promise<AuthenticatedResult> {
        const d   = this.d;
        const raw = await redisConnection.getdel(`impersonation:${ticket}`);
        if (!raw) throw authErrors.impersonationInvalid();

        let payload: { userId?: string; schoolId?: string; impersonatorId?: string; membershipId?: string };
        try { payload = JSON.parse(raw); } catch { throw authErrors.impersonationInvalid(); }

        if (!payload.userId || !payload.schoolId || !payload.impersonatorId) throw authErrors.impersonationInvalid();
        if (payload.schoolId !== hostSchoolId) throw authErrors.tenantMismatch();

        if (!(await d.membershipService.getActivePlatformMember(payload.impersonatorId))) {
            throw authErrors.impersonationInvalid();
        }

        const user = await d.userRepository.findById(payload.userId);
        if (!user || !user.isActive) throw authErrors.impersonationInvalid();

        const membership = payload.membershipId
            ? await d.membershipService.findById(payload.membershipId)
            : await d.membershipService.findByUserPersona(user.id, "STAFF");
        if (!membership || membership.userId !== user.id || membership.status !== "active") {
            throw authErrors.impersonationInvalid();
        }

        const tokens = await d.authSessionService.issue({
            userId: user.id, schoolId: hostSchoolId, membershipId: membership.id,
            mustChangePassword: false, ip: meta.ip, userAgent: meta.userAgent,
            impersonatorId: payload.impersonatorId,
            expiresAt: new Date(Date.now() + IMPERSONATION_MAX_MINUTES * 60_000),
        });

        await d.authAuditService.record({
            action: "auth.impersonation_started", actorType: "super_admin",
            userId: payload.impersonatorId, schoolId: hostSchoolId,
            entity: "User", entityId: user.id, ip: meta.ip, userAgent: meta.userAgent,
            metadata: { targetMembershipId: membership.id, maxMinutes: IMPERSONATION_MAX_MINUTES },
        });

        return {
            status:  "AUTHENTICATED",
            user:    d.userMapper.toResponse(user),
            session: { kind: "school", schoolId: hostSchoolId, membershipId: membership.id, persona: membership.persona },
            tokens,
        };
    }
}
