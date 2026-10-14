import { IInviteRepository } from "../repositories/invite.repository";
import { TokenService }      from "../../../shared/services/token.service";
import { InviteService }     from "../services/invite.service";
import { AuthAuditService }  from "../services/auth-audit.service";
import { authErrors }        from "../domain/auth.errors";
import { InviteActor, RequestMeta } from "../types/auth.types";

interface Dependencies {
    inviteRepository: IInviteRepository;
    tokenService:     TokenService;
    inviteService:    InviteService;
    authAuditService: AuthAuditService;
}

export class ManageInvitesUseCase {
    constructor(private readonly d: Dependencies) {}

    async list(schoolId: string) {
        const rows = await this.d.inviteRepository.listPending(schoolId);
        return Promise.all(rows.map(async i => ({
            id:        i.id,
            email:     i.email,
            persona:   i.persona,
            roleId:    i.roleId,
            roleName:  await this.d.inviteService.roleLabel(i),
            sentById:  i.sentById,
            expiresAt: i.expiresAt,
            createdAt: i.createdAt,
        })));
    }

    async revoke(id: string, schoolId: string, actor: InviteActor, meta: RequestMeta): Promise<{ message: string }> {
        if (!(await this.d.inviteRepository.revoke(id, schoolId))) throw authErrors.inviteInvalid();
        await this.d.authAuditService.record({
            action: "auth.invite_revoked", userId: actor.userId, schoolId, actorMembershipId: actor.membershipId,
            entity: "Invite", entityId: id, ip: meta.ip, userAgent: meta.userAgent,
        });
        return { message: "Invitation revoked" };
    }

    // New token and a fresh expiry; the old link stops working
    async resend(id: string, schoolId: string, actor: InviteActor, meta: RequestMeta): Promise<{ message: string; expiresAt: Date }> {
        const d      = this.d;
        const invite = await d.inviteRepository.findById(id, schoolId);
        if (!invite)           throw authErrors.inviteInvalid();
        if (invite.accepted)   throw authErrors.inviteUsed();
        if (invite.revokedAt)  throw authErrors.inviteRevoked();

        const rawToken  = d.tokenService.generateInviteToken();
        const expiresAt = d.inviteService.expiresAt();
        await d.inviteRepository.replaceToken(invite.id, d.inviteService.hash(rawToken), expiresAt);

        const school = await d.inviteService.getSchool(schoolId);
        await d.inviteService.deliver({ ...invite, expiresAt }, rawToken, school);

        await d.authAuditService.record({
            action: "auth.invite_resent", userId: actor.userId, schoolId, actorMembershipId: actor.membershipId,
            entity: "Invite", entityId: id, ip: meta.ip, userAgent: meta.userAgent,
        });
        return { message: `Invitation resent to ${invite.email}`, expiresAt };
    }
}
