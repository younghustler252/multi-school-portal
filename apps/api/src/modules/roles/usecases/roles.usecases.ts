import type { AccessService } from "../../../foundation/access.service";
import { canDelegateRole } from "../../../foundation/access.service";
import type { AuditService } from "../../audit/services/audit.service";
import { RolesRepository, RoleWithPermissions, Persona } from "../repositories/roles.repository";
import { CreateRoleDtoType, UpdateRoleDtoType, ListRolesQueryType } from "../dtos/role.dto";
import { RolesActor } from "../domain/roles.types";
import { roleErrors } from "../domain/roles.errors";

interface Dependencies { rolesRepository: RolesRepository; accessService: AccessService; auditService: AuditService }

const summarise = (r: RoleWithPermissions, memberCount: number) => ({
    id: r.id, name: r.name, description: r.description, kind: r.kind, persona: r.persona,
    grantsAll: r.grantsAll, isCustomized: r.isCustomized, sourceTemplateKey: r.sourceTemplateKey,
    editable: r.kind !== "SYSTEM_LOCKED",
    permissions: r.permissions.map(p => ({ key: p.permissionKey, scope: p.scope })),
    memberCount,
});

/** Every requested permission must exist, be usable at the requested scope, and be open to the STAFF persona (custom/editable roles are STAFF-only). */
async function validateRequestedPermissions(repo: RolesRepository, requested: Array<{ key: string; scope: string }>): Promise<void> {
    const defs = await repo.permissionDefsByKeys(requested.map(p => p.key));
    const bad = requested.filter(p => {
        const def = defs.get(p.key);
        return !def || !def.scopes.includes(p.scope as any) || !def.personas.includes("STAFF");
    });
    if (bad.length) throw roleErrors.permissionsInvalid(bad.map(p => p.key));
}

/** May `actor` hand out exactly this permission set? Every permission, at the scope requested, must be something the actor already holds (or they hold grants-all). */
function assertCanDelegate(actor: RolesActor, requested: Array<{ key: string; scope: string }>): void {
    const ok = canDelegateRole(requested.map(p => ({ key: p.key, scope: p.scope as any })), k => actor.access.scopeOf(k));
    if (!ok) throw roleErrors.notDelegatable();
}

/* GET /roles?persona= : every role in the school (staff only sees this; roles.view). */
export class ListRolesUseCase {
    constructor(private readonly d: { rolesRepository: RolesRepository }) {}
    async execute(query: ListRolesQueryType) {
        const roles = await this.d.rolesRepository.list(query.persona as Persona | undefined);
        const counts = await this.d.rolesRepository.memberCounts(roles.map(r => r.id));
        return roles.map(r => summarise(r, counts.get(r.id) ?? 0));
    }
}

/* GET /roles/:id */
export class GetRoleUseCase {
    constructor(private readonly d: { rolesRepository: RolesRepository }) {}
    async execute(id: string) {
        const role = await this.d.rolesRepository.findById(id);
        if (!role) throw roleErrors.notFound();
        return summarise(role, await this.d.rolesRepository.memberCount(id));
    }
}

/* GET /roles/:id/members : who holds this role right now (staff roles only — a student/guardian role is the whole persona, not useful to list one by one here). */
export class ListRoleMembersUseCase {
    constructor(private readonly d: { rolesRepository: RolesRepository }) {}
    async execute(id: string) {
        const role = await this.d.rolesRepository.findById(id);
        if (!role) throw roleErrors.notFound();
        return this.d.rolesRepository.members(id);
    }
}

/* GET /permissions : the catalog a role can be built from (roles.view, so the "create role" screen can list checkboxes). */
export class ListPermissionsUseCase {
    constructor(private readonly d: { rolesRepository: RolesRepository }) {}
    async execute() { return this.d.rolesRepository.permissionCatalog(); }
}

/*
| POST /roles : a new CUSTOM role (always persona STAFF — student and guardian roles are fixed, locked defaults
| assigned automatically, never created by hand). Never grants-all; that stays the locked School Admin role's alone.
| Every permission requested must be one the creator already holds, at a scope at least as wide (canDelegateRole),
| so nobody can create a role more powerful than themselves.
*/
export class CreateRoleUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, dto: CreateRoleDtoType, actor: RolesActor) {
        await validateRequestedPermissions(this.d.rolesRepository, dto.permissions);
        assertCanDelegate(actor, dto.permissions);
        if (await this.d.rolesRepository.findByName(dto.name)) throw roleErrors.nameTaken();

        const role = await this.d.rolesRepository.create({ name: dto.name, description: dto.description ?? null, persona: "STAFF", permissions: dto.permissions as any });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "roles.created", entity: "SchoolRole", entityId: role.id, newValue: { name: role.name, permissions: dto.permissions } });
        return summarise(role, 0);
    }
}

/*
| PUT /roles/:id : rename/describe, and/or replace the permission set entirely.
|   SYSTEM_LOCKED  -> refused outright (roleErrors.locked) — these exist so the platform can rely on them.
|   SYSTEM_EDITABLE -> permission changes mark it `isCustomized`, so the next template sync leaves it alone.
|   CUSTOM          -> edited freely.
| Same delegation rule as creating: every permission in the NEW set must be one the editor already holds themselves.
*/
export class UpdateRoleUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, dto: UpdateRoleDtoType, actor: RolesActor) {
        const role = await this.d.rolesRepository.findById(id);
        if (!role) throw roleErrors.notFound();
        if (role.kind === "SYSTEM_LOCKED") throw roleErrors.locked();

        if (dto.permissions) {
            await validateRequestedPermissions(this.d.rolesRepository, dto.permissions);
            assertCanDelegate(actor, dto.permissions);
        }
        if (dto.name && dto.name.toLowerCase() !== role.name.toLowerCase() && await this.d.rolesRepository.findByName(dto.name, id)) throw roleErrors.nameTaken();

        const before = { name: role.name, description: role.description, permissions: role.permissions };
        const updated = await this.d.rolesRepository.update(id, {
            name: dto.name, description: dto.description === undefined ? undefined : dto.description,
            permissions: dto.permissions as any, markCustomized: role.kind === "SYSTEM_EDITABLE" && !!dto.permissions,
        });

        this.d.accessService.invalidate();   // a role's permissions changed: drop every cached Access so it applies at once
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "roles.updated", entity: "SchoolRole", entityId: id,
            oldValue: before, newValue: { name: updated.name, description: updated.description, permissions: updated.permissions },
        });
        return summarise(updated, await this.d.rolesRepository.memberCount(id));
    }
}

/* DELETE /roles/:id : only an unused SYSTEM_EDITABLE or CUSTOM role (locked roles can never be deleted; a role still held by someone must be reassigned first). */
export class DeleteRoleUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, actor: RolesActor) {
        const role = await this.d.rolesRepository.findById(id);
        if (!role) throw roleErrors.notFound();
        if (role.kind === "SYSTEM_LOCKED") throw roleErrors.locked();

        const count = await this.d.rolesRepository.memberCount(id);
        if (count > 0) throw roleErrors.inUse(count);

        await this.d.rolesRepository.softDelete(id);
        this.d.accessService.invalidate();
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "roles.deleted", entity: "SchoolRole", entityId: id, oldValue: { name: role.name } });
        return { id };
    }
}
