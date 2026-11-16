import { PrismaClient } from "../../../generated/public/client";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import type { Scope } from "../../../foundation/access.service";
import { PortalStatus } from "../mappers/staff.mapper";

interface Dependencies { prismaClient: PrismaClient }

export interface StaffRoleRow {
    id: string; name: string; description: string | null;
    kind: "SYSTEM_LOCKED" | "SYSTEM_EDITABLE" | "CUSTOM";
    grantsAll: boolean;
    permissions: Array<{ key: string; scope: Scope }>;
}

/*
| PORTAL STATUS of staff members: do they have a login for this school?
|   none       no account and no pending invitation
|   invited    an invitation is waiting to be accepted
|   active     has portal access
|   suspended  access switched off (deactivated or removed)
| Two batched queries for a whole page of staff (never one query per row).
*/
export class StaffPortalService {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: Dependencies) { this.prisma = prismaClient; }

    async describe(schoolId: string, staffIds: string[]): Promise<Map<string, { status: PortalStatus; roles: { id: string; name: string }[] }>> {
        const out = new Map<string, { status: PortalStatus; roles: { id: string; name: string }[] }>();
        if (!staffIds.length) return out;

        const [members, invites] = await Promise.all([
            getTenantClient().membership.findMany({
                where: { persona: "STAFF", personaEntityId: { in: staffIds } },
                select: { personaEntityId: true, status: true, roles: { select: { role: { select: { id: true, name: true, deletedAt: true } } } } },
            }),
            this.prisma.invite.findMany({
                where: { schoolId, persona: "STAFF", personaEntityId: { in: staffIds }, accepted: false, revokedAt: null, expiresAt: { gt: new Date() } },
                select: { personaEntityId: true },
            }),
        ]);
        const invited = new Set(invites.map(i => i.personaEntityId));

        for (const id of staffIds) out.set(id, { status: invited.has(id) ? "invited" : "none", roles: [] });
        for (const m of members) {
            out.set(m.personaEntityId, {
                status: m.status === "active" ? "active" : "suspended",
                roles: m.roles.filter(r => !r.role.deletedAt).map(r => ({ id: r.role.id, name: r.role.name })),
            });
        }
        return out;
    }

    /**
     * Every live STAFF-persona role of this school with its permissions, in a stable order (system roles first, then by name).
     * Callers narrow it to what the acting person may grant; nothing here is shown to the client as it is.
     */
    async listStaffRoles(): Promise<StaffRoleRow[]> {
        const rows = await getTenantClient().schoolRole.findMany({
            where:   { persona: "STAFF", deletedAt: null },
            select:  { id: true, name: true, description: true, kind: true, grantsAll: true, permissions: { select: { permissionKey: true, scope: true } } },
            orderBy: [{ kind: "asc" }, { name: "asc" }],
        });
        return rows.map(r => ({
            id: r.id, name: r.name, description: r.description, kind: r.kind as StaffRoleRow["kind"], grantsAll: r.grantsAll,
            permissions: r.permissions.map(p => ({ key: p.permissionKey, scope: p.scope as Scope })),
        }));
    }

    /** Cancels invitations still waiting for this staff member (used when they are deactivated). */
    async cancelPendingInvites(schoolId: string, staffId: string): Promise<void> {
        await this.prisma.invite.updateMany({
            where: { schoolId, persona: "STAFF", personaEntityId: staffId, accepted: false, revokedAt: null },
            data:  { revokedAt: new Date() },
        });
    }
}
