import type { PrismaClient } from "../../../generated/public/client";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";

export type RoleKind = "SYSTEM_LOCKED" | "SYSTEM_EDITABLE" | "CUSTOM";
export type Persona  = "STAFF" | "STUDENT" | "GUARDIAN";
export type Scope    = "ALL" | "BRANCH" | "ASSIGNED" | "OWN";

export interface RoleRow {
    id: string; name: string; description: string | null; kind: RoleKind; persona: Persona;
    grantsAll: boolean; sourceTemplateKey: string | null; isCustomized: boolean; createdAt: Date; updatedAt: Date;
}
export interface RoleWithPermissions extends RoleRow { permissions: Array<{ permissionKey: string; scope: Scope }> }

export interface PermissionCatalogEntry {
    key: string; module: string; scopes: Scope[]; personas: Persona[]; label: string; description: string | null; isSensitive: boolean;
}

/*
| ROLES DATA ACCESS.
|   - SchoolRole / SchoolRolePermission / MembershipRole are TENANT tables (this school's own copy of each role).
|   - PermissionDefinition is a PLATFORM (public) table: the catalog of every permission that exists, kept in sync
|     from code (permissions.registry.ts) by the platform team. A school only ever READS it, to know what it can
|     build a role out of.
*/
export class RolesRepository {
    private readonly publicDb: PrismaClient;
    constructor({ prismaClient }: { prismaClient: PrismaClient }) { this.publicDb = prismaClient; }
    private get db() { return getTenantClient(); }

    async list(persona?: Persona): Promise<RoleWithPermissions[]> {
        return this.db.schoolRole.findMany({
            where:   { deletedAt: null, ...(persona ? { persona } : {}) },
            include: { permissions: { select: { permissionKey: true, scope: true } } },
            orderBy: [{ kind: "asc" }, { name: "asc" }],
        }) as unknown as Promise<RoleWithPermissions[]>;
    }

    async findById(id: string): Promise<RoleWithPermissions | null> {
        return this.db.schoolRole.findFirst({
            where:   { id, deletedAt: null },
            include: { permissions: { select: { permissionKey: true, scope: true } } },
        }) as unknown as Promise<RoleWithPermissions | null>;
    }

    async findByName(name: string, excludeId?: string): Promise<{ id: string } | null> {
        return this.db.schoolRole.findFirst({
            where: { name: { equals: name, mode: "insensitive" }, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
            select: { id: true },
        });
    }

    /** Active (non-removed) members currently holding this role, by persona — for the "who has this role" list and the delete-in-use check. */
    async memberCount(roleId: string): Promise<number> {
        return this.db.membershipRole.count({ where: { roleId, membership: { status: "active" } } });
    }

    async memberCounts(roleIds: string[]): Promise<Map<string, number>> {
        if (roleIds.length === 0) return new Map();
        const rows = await this.db.membershipRole.groupBy({
            by: ["roleId"], where: { roleId: { in: roleIds }, membership: { status: "active" } }, _count: { _all: true },
        });
        return new Map(rows.map(r => [r.roleId, r._count._all]));
    }

    /** Staff holding this role (active memberships only). Only meaningful for STAFF-persona roles. */
    async members(roleId: string): Promise<Array<{ membershipId: string; userId: string; assignedAt: Date; staffId: string; name: string; email: string | null }>> {
        const rows = await this.db.membershipRole.findMany({
            where:   { roleId, membership: { status: "active", persona: "STAFF" } },
            select:  { assignedAt: true, membership: { select: { id: true, userId: true, personaEntityId: true } } },
            orderBy: { assignedAt: "asc" },
        });
        if (rows.length === 0) return [];
        const staffIds = rows.map(r => r.membership.personaEntityId);
        const staff = await this.db.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true, email: true } });
        const byId = new Map(staff.map(s => [s.id, s]));
        return rows.map(r => {
            const s = byId.get(r.membership.personaEntityId);
            return { membershipId: r.membership.id, userId: r.membership.userId, assignedAt: r.assignedAt, staffId: r.membership.personaEntityId, name: s ? `${s.firstName} ${s.lastName}`.trim() : "Unknown", email: s?.email ?? null };
        });
    }

    async create(data: { name: string; description: string | null; persona: Persona; permissions: Array<{ key: string; scope: Scope }> }): Promise<RoleWithPermissions> {
        const role = await this.db.schoolRole.create({
            data: {
                name: data.name, description: data.description, kind: "CUSTOM", persona: data.persona, grantsAll: false,
                permissions: { createMany: { data: data.permissions.map(p => ({ permissionKey: p.key, scope: p.scope })) } },
            },
            include: { permissions: { select: { permissionKey: true, scope: true } } },
        });
        return role as unknown as RoleWithPermissions;
    }

    /** Replaces the permission set entirely when `permissions` is given; otherwise leaves it untouched. Marks a SYSTEM_EDITABLE role `isCustomized` so the template sync leaves it alone from now on. */
    async update(id: string, data: { name?: string; description?: string | null; permissions?: Array<{ key: string; scope: Scope }>; markCustomized: boolean }): Promise<RoleWithPermissions> {
        await this.db.$transaction(async tx => {
            await tx.schoolRole.update({
                where: { id },
                data: { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.description !== undefined ? { description: data.description } : {}), ...(data.markCustomized ? { isCustomized: true } : {}) },
            });
            if (data.permissions) {
                await tx.schoolRolePermission.deleteMany({ where: { roleId: id } });
                if (data.permissions.length) await tx.schoolRolePermission.createMany({ data: data.permissions.map(p => ({ roleId: id, permissionKey: p.key, scope: p.scope })) });
            }
        });
        return (await this.findById(id))!;
    }

    async softDelete(id: string): Promise<void> {
        await this.db.schoolRole.update({ where: { id }, data: { deletedAt: new Date() } });
    }

    /** The permission catalog a school can build a role out of: every SCHOOL-realm permission the platform knows about. */
    async permissionCatalog(): Promise<PermissionCatalogEntry[]> {
        const rows = await this.publicDb.permissionDefinition.findMany({
            where:   { realm: "SCHOOL", isDeprecated: false },
            orderBy: [{ module: "asc" }, { sortOrder: "asc" }],
            select:  { key: true, module: true, scopes: true, personas: true, label: true, description: true, isSensitive: true },
        });
        return rows as unknown as PermissionCatalogEntry[];
    }

    /** Full catalog entries for just these keys — for validating a role's requested permissions (do they exist? is the scope one that permission actually offers? is STAFF an allowed persona for it?). */
    async permissionDefsByKeys(keys: string[]): Promise<Map<string, PermissionCatalogEntry>> {
        if (keys.length === 0) return new Map();
        const rows = await this.publicDb.permissionDefinition.findMany({
            where: { key: { in: keys }, realm: "SCHOOL" },
            select: { key: true, module: true, scopes: true, personas: true, label: true, description: true, isSensitive: true },
        });
        return new Map(rows.map(r => [r.key, r as unknown as PermissionCatalogEntry]));
    }
}
