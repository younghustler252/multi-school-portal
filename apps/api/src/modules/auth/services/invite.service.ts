import { PrismaClient } from "../../../generated/public/client";
import { IInviteRepository } from "../repositories/invite.repository";
import { InviteEntity } from "../domain/auth.entity";
import { TokenHashService } from "./token-hash.service";
import { AuthMessageService } from "./auth-message.service";
import { MembershipService } from "./membership.service";
import { UrlService } from "../../../shared/services/url.service";
import { INVITE_EXPIRY_DAYS } from "../domain/auth.enums";
import { authErrors } from "../domain/auth.errors";

export interface InviteSchool {
    id: string; name: string; subdomain: string;
    customDomain: string | null; customDomainVerifiedAt: Date | null;
}

/*
|--------------------------------------------------------------------------
| INVITE SERVICE
| Shared by send, resend, validate and accept: token lookup and state checks,
| school lookup, and delivery of the invitation email.
|--------------------------------------------------------------------------
*/

export class InviteService {
    private readonly prisma:      PrismaClient;
    private readonly invites:     IInviteRepository;
    private readonly hasher:      TokenHashService;
    private readonly messages:    AuthMessageService;
    private readonly memberships: MembershipService;
    private readonly urls:        UrlService;

    constructor(d: {
        prismaClient: PrismaClient; inviteRepository: IInviteRepository; tokenHashService: TokenHashService;
        authMessageService: AuthMessageService; membershipService: MembershipService; urlService: UrlService;
    }) {
        this.prisma = d.prismaClient; this.invites = d.inviteRepository; this.hasher = d.tokenHashService;
        this.messages = d.authMessageService; this.memberships = d.membershipService; this.urls = d.urlService;
    }

    expiresAt(): Date {
        return new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000);
    }

    hash(rawToken: string): string {
        return this.hasher.hashToken(rawToken);
    }

    async getSchool(schoolId: string): Promise<InviteSchool> {
        const s = await this.prisma.school.findUnique({
            where:  { id: schoolId },
            select: { id: true, name: true, subdomain: true, customDomain: true, customDomainVerifiedAt: true },
        });
        if (!s) throw authErrors.notFound("School");
        return s;
    }

    /** Finds a usable invite for a raw token; the invite must belong to the school on the request host. */
    async loadUsable(rawToken: string, hostSchoolId: string): Promise<InviteEntity> {
        const invite = await this.invites.findByTokenHash(this.hash(rawToken));
        if (!invite || invite.schoolId !== hostSchoolId) throw authErrors.inviteInvalid();
        if (invite.revokedAt)             throw authErrors.inviteRevoked();
        if (invite.accepted)              throw authErrors.inviteUsed();
        if (invite.expiresAt < new Date()) throw authErrors.inviteExpired();
        return invite;
    }

    async roleLabel(invite: InviteEntity): Promise<string> {
        if (invite.persona !== "STAFF") return invite.persona.toLowerCase();
        const role = invite.roleId ? await this.memberships.getRole(invite.roleId) : null;
        return role?.name ?? "staff";
    }

    async deliver(invite: InviteEntity, rawToken: string, school: InviteSchool, firstName?: string): Promise<void> {
        await this.messages.sendEmail("auth.invite", invite.email, {
            "recipient.firstName": firstName,
            "school.name":         school.name,
            "invite.roleName":     await this.roleLabel(invite),
            "invite.expiresIn":    `${INVITE_EXPIRY_DAYS} days`,
            "invite.url":          this.urls.schoolUrl(school, `/accept-invite?token=${encodeURIComponent(rawToken)}`),
        });
    }
}
