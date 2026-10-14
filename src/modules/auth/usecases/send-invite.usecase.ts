import { IInviteRepository } from "../repositories/invite.repository";
import { IUserRepository }   from "../repositories/user.repository";
import { TokenService }      from "../../../shared/services/token.service";
import { InviteService }     from "../services/invite.service";
import { MembershipService, RoleRecord } from "../services/membership.service";
import { AuthAuditService }  from "../services/auth-audit.service";
import { legacyUserRole }    from "../services/legacy-role";
import { authErrors }        from "../domain/auth.errors";
import { SendInviteDtoType } from "../dtos/invite.dto";
import { InviteActor, RequestMeta } from "../types/auth.types";

interface Dependencies {
    inviteRepository:  IInviteRepository;
    userRepository:    IUserRepository;
    tokenService:      TokenService;
    inviteService:     InviteService;
    membershipService: MembershipService;
    authAuditService:  AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| SEND INVITE
| Route guard (users.invite) decides WHO may invite; this decides WHAT they may grant.
|  - STAFF: the role must exist in this school, and the inviter may only grant a role
|    whose every permission they hold themselves (a grants-all role only by a School Admin).
|    This closes the old hole where the role came straight from the request body.
|  - GUARDIAN / STUDENT: the person record must already exist; the locked default role applies.
|  - an existing account is allowed (it gains a second membership); someone who already holds
|    that capacity in this school is a conflict
|  - an earlier pending invite for the same person and capacity is revoked
|--------------------------------------------------------------------------
*/
export class SendInviteUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(
        dto: SendInviteDtoType, schoolId: string, actor: InviteActor, meta: RequestMeta,
    ): Promise<{ message: string; inviteId: string; expiresAt: Date }> {
        const d = this.d;

        // ── Decide and validate the role ─────────────────────────────────
        let role: RoleRecord | null;
        if (dto.persona === "STAFF") {
            role = await d.membershipService.getRole(dto.roleId!);
            if (!role || role.persona !== "STAFF") throw authErrors.badRequest("That role does not exist");
            if (role.grantsAll) {
                if (!actor.isAdmin) throw authErrors.roleNotAllowed();
            } else if (!role.permissionKeys.every(k => actor.can(k))) {
                throw authErrors.roleNotAllowed();
            }
        } else {
            role = await d.membershipService.getDefaultRoleForPersona(dto.persona);
            if (!role) throw authErrors.badRequest("This school has no default role for that profile yet");
            if (!(await d.membershipService.personaEntityAvailable(dto.persona, dto.personaEntityId!))) {
                throw authErrors.notFound("Person record");
            }
        }

        // ── Already a member? ────────────────────────────────────────────
        const existing = await d.userRepository.findByEmail(dto.email);
        if (existing && await d.membershipService.findByUserPersona(existing.id, dto.persona)) {
            throw authErrors.alreadyMember();
        }

        // ── Supersede earlier invites, create the new one ────────────────
        await d.inviteRepository.revokePendingForEmail(schoolId, dto.email, dto.persona);

        const rawToken  = d.tokenService.generateInviteToken();
        const expiresAt = d.inviteService.expiresAt();
        const invite = await d.inviteRepository.create({
            email:           dto.email,
            token:           d.inviteService.hash(rawToken),
            schoolId,
            sentById:        actor.userId,
            persona:         dto.persona,
            roleId:          role.id,
            personaEntityId: dto.personaEntityId ?? null,
            accepted:        false,
            expiresAt,
            role:            legacyUserRole(dto.persona, role.sourceTemplateKey), // transitional
        });

        const school = await d.inviteService.getSchool(schoolId);
        await d.inviteService.deliver(invite, rawToken, school, dto.firstName);

        await d.authAuditService.record({
            action: "auth.invite_sent", userId: actor.userId, schoolId, actorMembershipId: actor.membershipId,
            entity: "Invite", entityId: invite.id, ip: meta.ip, userAgent: meta.userAgent,
            metadata: { persona: dto.persona, roleId: role.id },
        });

        return { message: `Invitation sent to ${dto.email}`, inviteId: invite.id, expiresAt };
    }
}
