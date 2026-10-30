import { IUserRepository }    from "../repositories/user.repository";
import { UserMapper }         from "../mappers/user.mapper";
import { AuthSessionService } from "../services/auth-session.service";
import { MembershipService }  from "../services/membership.service";
import { AuthAuditService }   from "../services/auth-audit.service";
import { authErrors }         from "../domain/auth.errors";
import { AuthenticatedResult, PersonaType, RequestMeta } from "../types/auth.types";

interface Dependencies {
    userRepository:     IUserRepository;
    userMapper:         UserMapper;
    authSessionService: AuthSessionService;
    membershipService:  MembershipService;
    authAuditService:   AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| SWITCH PERSONA
| A person with several profiles in one school (for example a teacher who is
| also a guardian) moves between them without re-entering the password.
| Each persona is a separate session with its own refresh family.
|--------------------------------------------------------------------------
*/
export class SwitchPersonaUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(userId: string, schoolId: string, persona: PersonaType, meta: RequestMeta): Promise<AuthenticatedResult> {
        const d    = this.d;
        const user = await d.userRepository.findById(userId);
        if (!user || !user.isActive) throw authErrors.refreshInvalid();

        const m = await d.membershipService.findByUserPersona(userId, persona);
        if (!m || m.status !== "active") throw authErrors.personaUnavailable();

        const tokens = await d.authSessionService.issue({
            userId, schoolId, membershipId: m.id,
            mustChangePassword: user.mustChangePassword, ip: meta.ip, userAgent: meta.userAgent,
        });

        await d.authAuditService.record({
            action: "auth.persona_switched", userId, schoolId, actorMembershipId: m.id,
            ip: meta.ip, userAgent: meta.userAgent, metadata: { persona },
        });

        return {
            status:  "AUTHENTICATED",
            user:    d.userMapper.toResponse(user),
            session: { kind: "school", schoolId, membershipId: m.id, persona },
            tokens,
        };
    }
}
