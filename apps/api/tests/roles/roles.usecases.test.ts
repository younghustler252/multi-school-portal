import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    ListRolesUseCase, GetRoleUseCase, ListRoleMembersUseCase, ListPermissionsUseCase,
    CreateRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase,
} from "../../src/modules/roles/usecases/roles.usecases";

const R1 = "r1";
const schoolId = "sch1";

function role(over: Partial<any> = {}) {
    return {
        id: R1, name: "Branch Principal", description: null, kind: "CUSTOM", persona: "STAFF",
        grantsAll: false, isCustomized: false, sourceTemplateKey: null,
        permissions: [{ permissionKey: "students.view", scope: "BRANCH" }],
        ...over,
    };
}

/* A repo + access + audit rig shared by every test below; each test overrides only what it needs. */
function rig(opts: {
    roles?: any[]; byName?: any; memberCount?: number; defs?: Record<string, { scopes: string[]; personas: string[] }>;
    holds?: Record<string, string>;
} = {}) {
    const roles = opts.roles ?? [role()];
    const audits: any[] = [];
    const defs = opts.defs ?? { "students.view": { scopes: ["ALL", "BRANCH", "ASSIGNED", "OWN"], personas: ["STAFF"] } };
    const holds = opts.holds ?? { "students.view": "ALL" };

    const rolesRepository: any = {
        list: async () => roles,
        findById: async (id: string) => roles.find(r => r.id === id) ?? null,
        findByName: async (name: string, excludeId?: string) =>
            roles.find(r => r.name.toLowerCase() === name.toLowerCase() && r.id !== excludeId) ?? null,
        memberCount: async () => opts.memberCount ?? 0,
        memberCounts: async (ids: string[]) => new Map(ids.map(id => [id, opts.memberCount ?? 0])),
        members: async () => [{ membershipId: "m1", userId: "u1", assignedAt: new Date(), staffId: "st1", name: "Ada", email: "a@b.ng" }],
        create: async (data: any) => { const r = role({ id: "r-new", name: data.name, description: data.description, permissions: data.permissions.map((p: any) => ({ permissionKey: p.key, scope: p.scope })) }); roles.push(r); return r; },
        update: async (id: string, data: any) => {
            const r = roles.find(x => x.id === id);
            if (data.name !== undefined) r.name = data.name;
            if (data.description !== undefined) r.description = data.description;
            if (data.permissions) r.permissions = data.permissions.map((p: any) => ({ permissionKey: p.key, scope: p.scope }));
            if (data.markCustomized) r.isCustomized = true;
            return r;
        },
        softDelete: async (id: string) => { const r = roles.find(x => x.id === id); if (r) r.deletedAt = new Date(); },
        permissionCatalog: async () => Object.keys(defs).map(key => ({ key, ...defs[key] })),
        permissionDefsByKeys: async (keys: string[]) => new Map(keys.filter(k => defs[k]).map(k => [k, defs[k]])),
    };
    let invalidated = 0;
    const accessService: any = { invalidate: () => { invalidated++; } };
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const access: any = { scopeOf: (k: string) => holds[k] ?? null };
    const actor = { userId: "u1", access };

    return { rolesRepository, accessService, auditService, audits, actor, invalidatedCount: () => invalidated, roles };
}

describe("reads", () => {
    it("lists roles with member counts attached", async () => {
        const d = rig({ memberCount: 3 });
        const out = await new ListRolesUseCase(d).execute({} as any);
        assert.equal(out.length, 1);
        assert.equal(out[0].memberCount, 3);
        assert.equal(out[0].editable, true);
    });
    it("a SYSTEM_LOCKED role is not editable in the summary", async () => {
        const d = rig({ roles: [role({ kind: "SYSTEM_LOCKED" })] });
        const out = await new ListRolesUseCase(d).execute({} as any);
        assert.equal(out[0].editable, false);
    });
    it("get rejects an unknown id", async () => {
        const d = rig();
        await assert.rejects(() => new GetRoleUseCase(d).execute("nope"), (e: any) => e.statusCode === 404);
    });
    it("get returns the role and its member count", async () => {
        const d = rig({ memberCount: 2 });
        const out = await new GetRoleUseCase(d).execute(R1);
        assert.equal(out.id, R1); assert.equal(out.memberCount, 2);
    });
    it("members requires the role to exist", async () => {
        const d = rig();
        await assert.rejects(() => new ListRoleMembersUseCase(d).execute("nope"), (e: any) => e.statusCode === 404);
        const members = await new ListRoleMembersUseCase(d).execute(R1);
        assert.equal(members[0].name, "Ada");
    });
    it("lists the permission catalog", async () => {
        const d = rig();
        const out = await new ListPermissionsUseCase(d).execute();
        assert.equal(out[0].key, "students.view");
    });
});

describe("create", () => {
    it("refuses a permission key that is not real", async () => {
        const d = rig();
        await assert.rejects(
            () => new CreateRoleUseCase(d).execute(schoolId, { name: "X", permissions: [{ key: "ghost.key", scope: "ALL" }] } as any, d.actor),
            (e: any) => e.code === "ROLE_PERMISSIONS_INVALID",
        );
    });
    it("refuses a scope the permission does not offer", async () => {
        const d = rig({ defs: { "students.view": { scopes: ["OWN"], personas: ["STAFF"] } } });
        await assert.rejects(
            () => new CreateRoleUseCase(d).execute(schoolId, { name: "X", permissions: [{ key: "students.view", scope: "ALL" }] } as any, d.actor),
            (e: any) => e.code === "ROLE_PERMISSIONS_INVALID",
        );
    });
    it("refuses granting wider than the actor holds (delegation)", async () => {
        const d = rig({ holds: { "students.view": "OWN" } });
        await assert.rejects(
            () => new CreateRoleUseCase(d).execute(schoolId, { name: "X", permissions: [{ key: "students.view", scope: "ALL" }] } as any, d.actor),
            (e: any) => e.code === "FORBIDDEN",
        );
    });
    it("refuses a duplicate name", async () => {
        const d = rig();
        await assert.rejects(
            () => new CreateRoleUseCase(d).execute(schoolId, { name: "Branch Principal", permissions: [] } as any, d.actor),
            (e: any) => e.code === "ROLE_NAME_TAKEN",
        );
    });
    it("creates a CUSTOM, non-grants-all, STAFF role and audits it", async () => {
        const d = rig();
        const out = await new CreateRoleUseCase(d).execute(schoolId, { name: "New Role", permissions: [{ key: "students.view", scope: "OWN" }] } as any, d.actor);
        assert.equal(out.name, "New Role");
        assert.equal(d.roles.find(r => r.name === "New Role").grantsAll, false);
        assert.equal(d.audits[0].action, "roles.created");
    });
});

describe("update", () => {
    it("rejects an unknown id", async () => {
        const d = rig();
        await assert.rejects(() => new UpdateRoleUseCase(d).execute(schoolId, "nope", { name: "X" } as any, d.actor), (e: any) => e.statusCode === 404);
    });
    it("a SYSTEM_LOCKED role can never be edited", async () => {
        const d = rig({ roles: [role({ kind: "SYSTEM_LOCKED" })] });
        await assert.rejects(() => new UpdateRoleUseCase(d).execute(schoolId, R1, { name: "X" } as any, d.actor), (e: any) => e.code === "ROLE_LOCKED");
    });
    it("editing a SYSTEM_EDITABLE role's permissions marks it customized and invalidates access cache", async () => {
        const d = rig({ roles: [role({ kind: "SYSTEM_EDITABLE", isCustomized: false })] });
        const out = await new UpdateRoleUseCase(d).execute(schoolId, R1, { permissions: [{ key: "students.view", scope: "OWN" }] } as any, d.actor);
        assert.equal(out.isCustomized, true);
        assert.equal(d.invalidatedCount(), 1);
        assert.equal(d.audits[0].action, "roles.updated");
    });
    it("renaming a SYSTEM_EDITABLE role without touching permissions does not mark it customized", async () => {
        const d = rig({ roles: [role({ kind: "SYSTEM_EDITABLE", isCustomized: false })] });
        const out = await new UpdateRoleUseCase(d).execute(schoolId, R1, { name: "Renamed" } as any, d.actor);
        assert.equal(out.isCustomized, false);
    });
    it("refuses delegating wider permissions than the actor holds", async () => {
        const d = rig({ holds: { "students.view": "OWN" } });
        await assert.rejects(
            () => new UpdateRoleUseCase(d).execute(schoolId, R1, { permissions: [{ key: "students.view", scope: "ALL" }] } as any, d.actor),
            (e: any) => e.code === "FORBIDDEN",
        );
    });
    it("refuses renaming to a name already taken by another role", async () => {
        const d = rig({ roles: [role(), role({ id: "r2", name: "Other" })] });
        await assert.rejects(() => new UpdateRoleUseCase(d).execute(schoolId, "r2", { name: "Branch Principal" } as any, d.actor), (e: any) => e.code === "ROLE_NAME_TAKEN");
    });
});

describe("delete", () => {
    it("rejects an unknown id", async () => {
        const d = rig();
        await assert.rejects(() => new DeleteRoleUseCase(d).execute(schoolId, "nope", d.actor), (e: any) => e.statusCode === 404);
    });
    it("a SYSTEM_LOCKED role can never be deleted", async () => {
        const d = rig({ roles: [role({ kind: "SYSTEM_LOCKED" })] });
        await assert.rejects(() => new DeleteRoleUseCase(d).execute(schoolId, R1, d.actor), (e: any) => e.code === "ROLE_LOCKED");
    });
    it("a role still in use cannot be deleted", async () => {
        const d = rig({ memberCount: 2 });
        await assert.rejects(() => new DeleteRoleUseCase(d).execute(schoolId, R1, d.actor), (e: any) => e.code === "ROLE_IN_USE");
    });
    it("an unused CUSTOM role is soft-deleted and the access cache is invalidated", async () => {
        const d = rig({ memberCount: 0 });
        const out = await new DeleteRoleUseCase(d).execute(schoolId, R1, d.actor);
        assert.equal(out.id, R1);
        assert.ok(d.roles[0].deletedAt);
        assert.equal(d.invalidatedCount(), 1);
        assert.equal(d.audits[0].action, "roles.deleted");
    });
});
