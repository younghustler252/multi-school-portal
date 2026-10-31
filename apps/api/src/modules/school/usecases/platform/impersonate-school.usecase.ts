import { randomUUID } from "crypto";
import { z } from "zod";
import type { PrismaClient } from "../../../../generated/public";
import type { MembershipService } from "../../../auth/services/membership.service";
import type { AuthAuditService } from "../../../auth/services/auth-audit.service";
import type { UrlService } from "../../../../shared/services/url.service";
import { TenantContext } from "../../../../infrastructure/database/prisma/tenant.context";
import { impersonationErrors as errs } from "../../domain/impersonation.errors";

/*
| IMPERSONATION, ISSUING SIDE (platform realm; the receiving side is auth/exchange-impersonation-token).
| A platform staff member with platform.schools.impersonate enters a school as one of its staff (by default the school admin).
|  - a written reason is mandatory and is stored in the audit log with who, which school and who they entered as
|  - this only creates a ONE-USE ticket that lives 60 seconds; the school host exchanges it for a session that
|    carries the platform member's id (`imp`), is capped at IMPERSONATION_MAX_MINUTES and cannot change passwords
|  - only an ACTIVE school (database ready) can be entered, and never as another platform member
*/
export const IMPERSONATION_TICKET_TTL_SECONDS = 60;

export const ImpersonateSchoolDto = z.object({
    reason:       z.string().trim().min(10, "Say why you need to enter this school (at least 10 characters)").max(500),
    membershipId: z.string().trim().min(1).max(64).optional(),
}).strict();
export type ImpersonateSchoolDtoType = z.infer<typeof ImpersonateSchoolDto>;

export interface TicketStore { put(ticket: string, payload: Record<string, unknown>, ttlSeconds: number): Promise<void> }

/** The real store (Redis), loaded on first use so importing this file never opens a connection. */
export function redisTicketStore(): TicketStore {
    return {
        async put(ticket, payload, ttlSeconds) {
            const { redisConnection } = await import("../../../../infrastructure/jobs/connection");
            await redisConnection.set(`impersonation:${ticket}`, JSON.stringify(payload), "EX", ttlSeconds);
        },
    };
}

interface Dependencies {
    prismaClient:      PrismaClient;
    membershipService: MembershipService;
    authAuditService:  AuthAuditService;
    urlService:        UrlService;
    ticketStore:       TicketStore;
}

export class ImpersonateSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(actorUserId: string, schoolId: string, dto: ImpersonateSchoolDtoType, meta: { ip?: string | null; userAgent?: string | null } = {}) {
        const d = this.d;

        if (!(await d.membershipService.getActivePlatformMember(actorUserId))) throw errs.actorNotAllowed();

        const school = await d.prismaClient.school.findFirst({
            where:  { id: schoolId, deletedAt: null },
            select: { id: true, name: true, subdomain: true, customDomain: true, customDomainVerifiedAt: true, status: true, schemaName: true, schemaProvisionedAt: true },
        });
        if (!school) throw errs.schoolNotFound();
        if (school.status !== "active") throw errs.notReady(`the school is ${school.status}`);
        if (!school.schemaName || !school.schemaProvisionedAt) throw errs.notReady("its database is not ready yet");

        const target = await TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id }, async () => {
            let membership;
            if (dto.membershipId) {
                membership = await d.membershipService.findById(dto.membershipId);
                if (!membership) throw errs.badTarget("no such member in this school");
            } else {
                const adminIds = await d.membershipService.listActiveUserIdsByRoleKey("school_admin");
                for (const uid of adminIds) {
                    const m = await d.membershipService.findByUserPersona(uid, "STAFF");
                    if (m && m.status === "active") { membership = m; break; }
                }
                if (!membership) throw errs.noTarget();
            }
            if (membership.persona !== "STAFF") throw errs.badTarget("only staff accounts can be entered");
            if (membership.status !== "active") throw errs.badTarget("the account is not active");
            return membership;
        });

        // Never use this door to become another platform member
        if (await d.membershipService.getActivePlatformMember(target.userId)) throw errs.badTarget("platform staff cannot be entered as");

        const ticket = randomUUID();
        await d.ticketStore.put(ticket, {
            userId: target.userId, schoolId: school.id, impersonatorId: actorUserId, membershipId: target.id,
        }, IMPERSONATION_TICKET_TTL_SECONDS);

        await d.authAuditService.record({
            action: "platform.impersonation_issued", module: "school", actorType: "super_admin",
            userId: actorUserId, schoolId: school.id, entity: "School", entityId: school.id,
            ip: meta.ip ?? null, userAgent: meta.userAgent ?? null,
            metadata: { reason: dto.reason, targetMembershipId: target.id, targetUserId: target.userId },
        });

        return {
            redirectUrl:      d.urlService.schoolUrl(school, `/impersonate-entry?ticket=${ticket}`),
            school:           { id: school.id, name: school.name },
            target:           { membershipId: target.id, userId: target.userId },
            expiresInSeconds: IMPERSONATION_TICKET_TTL_SECONDS,
        };
    }
}
