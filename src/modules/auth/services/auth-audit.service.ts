import { PrismaClient } from "../../../generated/public/client";

export interface AuthAuditEntry {
    action:       string;                         // e.g. auth.login, auth.login_failed, auth.invite_sent
    userId?:      string | null;
    schoolId?:    string | null;
    actorType?:   "user" | "system" | "super_admin";
    oldValue?:    Record<string, unknown>;
    newValue?:    Record<string, unknown>;
    actorMembershipId?: string | null;
    entity?:      string;
    module?:      string;                         // defaults to "auth"
    entityId?:    string | null;
    ip?:          string | null;
    userAgent?:   string | null;
    metadata?:    Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| AUTH AUDIT
| Best effort: an audit failure must never break sign-in. Never put secrets,
| raw emails of unknown accounts, codes or tokens in metadata.
|--------------------------------------------------------------------------
*/
export class AuthAuditService {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    async record(e: AuthAuditEntry): Promise<void> {
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId:     e.userId ?? null,
                    schoolId:   e.schoolId ?? null,
                    actorType:  e.actorType ?? "user",
                    actorMembershipId: e.actorMembershipId ?? null,
                    action:     e.action,
                    entity:     e.entity ?? "auth",
                    entityId:   e.entityId ?? null,
                    module:     e.module ?? "auth",
                    ipAddress:  e.ip ?? null,
                    userAgent:  e.userAgent ? e.userAgent.slice(0, 255) : null,
                    oldValue:   (e.oldValue ?? undefined) as never,
                    newValue:   (e.newValue ?? undefined) as never,
                    metadata:   (e.metadata ?? undefined) as never,
                },
            });
        } catch (err) {
            console.error("[auth-audit] failed to write audit entry:", (err as Error).message);
        }
    }
}
