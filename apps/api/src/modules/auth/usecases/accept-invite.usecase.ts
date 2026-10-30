import { IInviteRepository } from "../repositories/invite.repository";
import { IUserRepository }   from "../repositories/user.repository";
import { PasswordService }   from "../../../shared/services/password.service";
import { UserMapper }        from "../mappers/user.mapper";
import { InviteService }     from "../services/invite.service";
import { MembershipService } from "../services/membership.service";
import { AuthPolicyService } from "../services/auth-policy.service";
import { AuthSessionService } from "../services/auth-session.service";
import { LoginAttemptService } from "../services/login-attempt.service";
import { AuthMessageService } from "../services/auth-message.service";
import { AuthAuditService }  from "../services/auth-audit.service";
import { legacyUserRole }    from "../services/legacy-role";
import { UrlService }        from "../../../shared/services/url.service";
import { authErrors }        from "../domain/auth.errors";
import { AcceptInviteDtoType } from "../dtos/invite.dto";
import { AuthenticatedResult, RequestMeta } from "../types/auth.types";

interface Dependencies {
    inviteRepository:    IInviteRepository;
    userRepository:      IUserRepository;
    passwordService:     PasswordService;
    userMapper:          UserMapper;
    inviteService:       InviteService;
    membershipService:   MembershipService;
    authPolicyService:   AuthPolicyService;
    authSessionService:  AuthSessionService;
    loginAttemptService: LoginAttemptService;
    authMessageService:  AuthMessageService;
    authAuditService:    AuthAuditService;
    urlService:          UrlService;
}

/*
|--------------------------------------------------------------------------
| ACCEPT INVITE
| Works for NEW people (create the account) and EXISTING accounts (add a
| membership after confirming their current password), so one login can hold
| several schools and personas.
|
| Safe against double use: the invite is claimed atomically first. The steps span
| two databases (public + tenant) so a failure after the claim compensates:
| the claim is released and a freshly created user is removed.
| Must run on the school's own host (tenant context active).
|--------------------------------------------------------------------------
*/
export class AcceptInviteUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: AcceptInviteDtoType, hostSchoolId: string, meta: RequestMeta): Promise<AuthenticatedResult> {
        const d      = this.d;
        const invite = await d.inviteService.loadUsable(dto.token, hostSchoolId);

        const role = invite.roleId
            ? await d.membershipService.getRole(invite.roleId)
            : await d.membershipService.getDefaultRoleForPersona(invite.persona);
        if (!role) throw authErrors.badRequest("The role for this invitation no longer exists. Ask for a new invite");

        const existing = await d.userRepository.findByEmail(invite.email);

        // ── Existing account: prove ownership, never create a duplicate ──
        if (existing) {
            await d.loginAttemptService.assertNotBlocked(invite.email, meta.ip);
            const full = await d.userRepository.findByEmailWithPassword(invite.email);
            if (!full || !(await d.passwordService.compare(dto.password, full.passwordHash))) {
                await d.loginAttemptService.recordFailure(invite.email, meta.ip);
                throw authErrors.invalidCredentials();
            }
            await d.loginAttemptService.clear(invite.email, meta.ip);
            if (!existing.isActive) throw authErrors.accountInactive();
            if (await d.membershipService.findByUserPersona(existing.id, invite.persona)) throw authErrors.alreadyMember();
        } else {
            // A staff member invited from an existing staff record can skip typing their name: it comes from that record
            if ((!dto.firstName || !dto.lastName) && invite.persona === "STAFF" && invite.personaEntityId) {
                const c = await d.membershipService.getStaffContact(invite.personaEntityId);
                if (c) { dto = { ...dto, firstName: dto.firstName || c.firstName, lastName: dto.lastName || c.lastName, phone: dto.phone || c.phone || undefined }; }
            }
            if (!dto.firstName || !dto.lastName) throw authErrors.badRequest("First name and last name are required");
            if (dto.password !== dto.confirmPassword) throw authErrors.badRequest("Passwords do not match");
            await d.authPolicyService.assertPasswordAllowed(dto.password, true);
        }

        // ── Claim (single winner) ────────────────────────────────────────
        if (!(await d.inviteRepository.claim(invite.id))) throw authErrors.inviteUsed();

        let createdUserId: string | null = null;
        try {
            const user = existing ?? await d.userRepository.create({
                email:           invite.email,
                passwordHash:    await d.passwordService.hash(dto.password),
                firstName:       dto.firstName,
                lastName:        dto.lastName,
                phone:           dto.phone,
                isActive:        true,
                isEmailVerified: true,                 // the invite reached this inbox
                emailVerifiedAt: new Date(),
                role:            legacyUserRole(invite.persona, role.sourceTemplateKey), // transitional
                schoolId:        invite.schoolId,                                       // transitional
            });
            if (!existing) createdUserId = user.id;
            else if (!existing.isEmailVerified) {
                await d.userRepository.update(existing.id, { isEmailVerified: true, emailVerifiedAt: new Date() });
            }

            const entityId = await d.membershipService.linkPersonaEntity(
                invite.persona, invite.personaEntityId, user.id, role.sourceTemplateKey,
            );
            const membership = await d.membershipService.createMembership({
                userId: user.id, persona: invite.persona, personaEntityId: entityId,
                roleId: role.id, assignedById: invite.sentById,
            });
            await d.membershipService.ensureUserSchool(user.id, invite.schoolId);

            const tokens = await d.authSessionService.issue({
                userId: user.id, schoolId: invite.schoolId, membershipId: membership.id,
                mustChangePassword: user.mustChangePassword, ip: meta.ip, userAgent: meta.userAgent,
            });

            const school = await d.inviteService.getSchool(invite.schoolId);
            d.authMessageService.sendEmailSafely("auth.welcome", user.email, {
                "recipient.firstName": user.firstName ?? dto.firstName,
                "school.name":         school.name,
                "school.url":          d.urlService.schoolUrl(school),
            });

            await d.authAuditService.record({
                action: "auth.invite_accepted", userId: user.id, schoolId: invite.schoolId,
                actorMembershipId: membership.id, entity: "Invite", entityId: invite.id,
                ip: meta.ip, userAgent: meta.userAgent,
                metadata: { persona: invite.persona, newAccount: !existing },
            });

            return {
                status:  "AUTHENTICATED",
                user:    d.userMapper.toResponse(user),
                session: { kind: "school", schoolId: invite.schoolId, membershipId: membership.id, persona: invite.persona },
                tokens,
            };
        } catch (err) {
            await d.inviteRepository.unclaim(invite.id).catch(() => undefined);
            if (createdUserId) await d.userRepository.deleteById(createdUserId).catch(() => undefined);
            throw err;
        }
    }
}
