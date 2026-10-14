import { PrismaClient } from "../../../generated/public/client";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { UrlService } from "../../../shared/services/url.service";
import { PersonaType } from "../types/auth.types";
import { legacyStaffRole } from "./legacy-role";
import { authErrors } from "../domain/auth.errors";

export interface MembershipRecord {
    id:              string;
    userId:          string;
    persona:         PersonaType;
    personaEntityId: string;
    status:          string;
}

export interface RoleRecord {
    id:                string;
    name:              string;
    grantsAll:         boolean;
    persona:           PersonaType;
    sourceTemplateKey: string | null;
    permissionKeys:    string[];
}

/*
|--------------------------------------------------------------------------
| MEMBERSHIP SERVICE
| Everything that touches who-belongs-where.
|  - Tenant methods (membership, roles, persona records) use getTenantClient()
|    and REQUIRE an active tenant context (request on the school host, or the
|    provisioning worker running inside the school's context).
|  - Public methods (PlatformMember, UserSchool) use the public client.
| UserSchool is a discovery index only; authority is always the tenant Membership.
|--------------------------------------------------------------------------
*/

export class MembershipService {
    private readonly prisma: PrismaClient;
    private readonly urls:   UrlService;

    constructor({ prismaClient, urlService }: { prismaClient: PrismaClient; urlService: UrlService }) {
        this.prisma = prismaClient;
        this.urls   = urlService;
    }

    // ── Platform (public) ────────────────────────────────────────────────
    async getActivePlatformMember(userId: string): Promise<{ id: string } | null> {
        return this.prisma.platformMember.findFirst({
            where:  { userId, status: "active" },
            select: { id: true },
        });
    }

    async listUserSchools(userId: string): Promise<{ id: string; name: string; url: string }[]> {
        const links = await this.prisma.userSchool.findMany({
            where: { userId, school: { isActive: true, status: "active", deletedAt: null } },
            select: { school: { select: { id: true, name: true, subdomain: true, customDomain: true, customDomainVerifiedAt: true } } },
        });
        return links.map(l => ({ id: l.school.id, name: l.school.name, url: this.urls.schoolUrl(l.school) }));
    }

    async ensureUserSchool(userId: string, schoolId: string): Promise<void> {
        await this.prisma.userSchool.upsert({
            where:  { userId_schoolId: { userId, schoolId } },
            update: {},
            create: { userId, schoolId },
        });
    }

    // ── Tenant: memberships ──────────────────────────────────────────────
    private toRecord(m: { id: string; userId: string; persona: string; personaEntityId: string; status: string }): MembershipRecord {
        return { id: m.id, userId: m.userId, persona: m.persona as PersonaType, personaEntityId: m.personaEntityId, status: m.status };
    }

    async findById(id: string): Promise<MembershipRecord | null> {
        const m = await getTenantClient().membership.findUnique({ where: { id } });
        return m ? this.toRecord(m) : null;
    }

    async listActive(userId: string): Promise<MembershipRecord[]> {
        const rows = await getTenantClient().membership.findMany({ where: { userId, status: "active" } });
        return rows.map(r => this.toRecord(r));
    }

    async findByUserPersona(userId: string, persona: PersonaType): Promise<MembershipRecord | null> {
        const m = await getTenantClient().membership.findFirst({ where: { userId, persona } });
        return m ? this.toRecord(m) : null;
    }

    // Tenant: ids of users holding an active STAFF membership with a role from this template key
    async listActiveUserIdsByRoleKey(roleKey: string): Promise<string[]> {
        const rows = await getTenantClient().membershipRole.findMany({
            where: {
                role:       { sourceTemplateKey: roleKey, deletedAt: null },
                membership: { status: "active", persona: "STAFF" },
            },
            select: { membership: { select: { userId: true } } },
        });
        return [...new Set(rows.map(r => r.membership.userId))];
    }

    // ── Tenant: roles ────────────────────────────────────────────────────
    async getRole(roleId: string): Promise<RoleRecord | null> {
        const db   = getTenantClient();
        const role = await db.schoolRole.findFirst({ where: { id: roleId, deletedAt: null } });
        if (!role) return null;
        const perms = await db.schoolRolePermission.findMany({ where: { roleId }, select: { permissionKey: true } });
        return {
            id: role.id, name: role.name, grantsAll: role.grantsAll,
            persona: role.persona as PersonaType, sourceTemplateKey: role.sourceTemplateKey ?? null,
            permissionKeys: perms.map(p => p.permissionKey),
        };
    }

    // Student and guardian roles are locked and auto-assigned by persona (template key = persona)
    async getDefaultRoleForPersona(persona: PersonaType): Promise<RoleRecord | null> {
        const role = await getTenantClient().schoolRole.findFirst({
            where: { sourceTemplateKey: persona.toLowerCase(), deletedAt: null },
            select: { id: true },
        });
        return role ? this.getRole(role.id) : null;
    }

    // ── Tenant: link a login to the school's person record ───────────────
    /**
     * STAFF: uses the given Staff row, or the user's existing one, or creates a minimal one
     *        (the staff module owns richer staff data later).
     * GUARDIAN / STUDENT: the record must already exist; its userId is set.
     * Returns the persona entity id.
     */
    async linkPersonaEntity(
        persona: PersonaType, entityId: string | null, userId: string, templateKey: string | null,
    ): Promise<string> {
        const db = getTenantClient();

        if (persona === "STAFF") {
            if (entityId) {
                const s = await db.staff.findUnique({ where: { id: entityId } });
                if (!s || s.userId !== userId) throw authErrors.inviteInvalid();
                return s.id;
            }
            const existing = await db.staff.findUnique({ where: { userId } });
            if (existing) return existing.id;
            const created = await db.staff.create({
                data: {
                    userId,
                    isActive: true,
                    category: templateKey === "teacher" ? "teaching" : "non_teaching",
                    role:     legacyStaffRole(templateKey),
                },
            });
            return created.id;
        }

        if (!entityId) throw authErrors.inviteInvalid();

        if (persona === "GUARDIAN") {
            const g = await db.guardian.findUnique({ where: { id: entityId } });
            if (!g || (g.userId && g.userId !== userId)) throw authErrors.inviteInvalid();
            if (!g.userId) await db.guardian.update({ where: { id: g.id }, data: { userId } });
            return g.id;
        }

        const st = await db.student.findUnique({ where: { id: entityId } });
        if (!st || (st.userId && st.userId !== userId)) throw authErrors.inviteInvalid();
        if (!st.userId) await db.student.update({ where: { id: st.id }, data: { userId } });
        return st.id;
    }

    /** Persona record that an invite for this persona/entity would attach to (existence check at send time). */
    async personaEntityAvailable(persona: PersonaType, entityId: string): Promise<boolean> {
        const db = getTenantClient();
        if (persona === "GUARDIAN") return !!(await db.guardian.findUnique({ where: { id: entityId }, select: { id: true } }));
        if (persona === "STUDENT")  return !!(await db.student.findUnique({  where: { id: entityId }, select: { id: true } }));
        return !!(await db.staff.findUnique({ where: { id: entityId }, select: { id: true } }));
    }

    async createMembership(p: {
        userId: string; persona: PersonaType; personaEntityId: string; roleId: string; assignedById?: string | null;
    }): Promise<MembershipRecord> {
        const db = getTenantClient();
        const m  = await db.membership.create({
            data: { userId: p.userId, persona: p.persona, personaEntityId: p.personaEntityId, status: "active" },
        });
        try {
            await db.membershipRole.create({
                data: { membershipId: m.id, roleId: p.roleId, assignedById: p.assignedById ?? null },
            });
        } catch (err) {
            await db.membership.delete({ where: { id: m.id } }).catch(() => undefined);
            throw err;
        }
        return this.toRecord(m);
    }

    /**
     * PROVISIONING HOOK. Call from the school provisioning worker, INSIDE the new school's tenant
     * context, after tenant migrations and role-template seeding. Registration stores the admin in
     * UserSchool; this creates the real authority (Staff record + Membership + School Admin role).
     * Idempotent.
     */
    async provisionFirstAdmin(schoolId: string): Promise<MembershipRecord> {
        const link = await this.prisma.userSchool.findFirst({
            where: { schoolId }, orderBy: { createdAt: "asc" }, select: { userId: true },
        });
        if (!link) throw authErrors.notFound("School administrator");

        const existing = await this.findByUserPersona(link.userId, "STAFF");
        if (existing) return existing;

        const role = await getTenantClient().schoolRole.findFirst({
            where: { sourceTemplateKey: "school_admin", deletedAt: null }, select: { id: true },
        });
        if (!role) throw authErrors.notFound("School Admin role (seed role templates before provisioning admins)");

        const entityId = await this.linkPersonaEntity("STAFF", null, link.userId, "school_admin");
        return this.createMembership({ userId: link.userId, persona: "STAFF", personaEntityId: entityId, roleId: role.id });
    }
}
