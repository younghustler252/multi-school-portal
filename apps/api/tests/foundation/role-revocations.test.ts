/*
| DELIBERATE ROLE REVOCATIONS: the one way a default role loses a permission.
| Rules under test: only named permissions; only editable templates; never a role the school has customised (it is
| listed as pending instead); never before the platform template is revoked; repeating changes nothing.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { validateRevocations, planRoleRevocations, type SchoolRoleView, type TemplateView, type RevocationView } from "../../src/foundation/role-grants.planner";
import { syncRoleTemplates } from "../../src/foundation/sync-role-templates";
import { syncSchoolRoles, loadTemplateViews } from "../../src/foundation/sync-school-roles";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { ROLE_REVOCATIONS } from "../../src/foundation/role-revocations.registry";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";

const g = (key: string, scope = "ALL") => ({ key, scope });
const REV: RevocationView = { id: "r1", templateKey: "principal", permissions: ["school.update", "automation.manage"], reason: "configuration belongs to the school admin" };

const role = (over: Partial<SchoolRoleView> = {}): SchoolRoleView => ({
    id: "role1", name: "Principal", kind: "SYSTEM_EDITABLE", grantsAll: false, isCustomized: false, sourceTemplateKey: "principal", sourceTemplateVersion: 4,
    grants: [g("school.view"), g("school.update"), g("automation.manage")], ...over,
});
const tpl = (over: Partial<TemplateView> = {}): TemplateView => ({ key: "principal", version: 5, isActive: true, grantsAll: false, grants: [g("school.view")], ...over });

describe("the list shipped in the code", () => {
    it("is valid against the real templates (so a bad entry fails the build, not a deploy)", () => {
        assert.deepEqual(validateRevocations(ROLE_REVOCATIONS, ROLE_TEMPLATES.map(t => ({ key: t.key, locked: t.locked, permissions: t.permissions }))), []);
    });
});

describe("validateRevocations", () => {
    const templates = [{ key: "principal", locked: false, permissions: [{ key: "school.view" }] }, { key: "student", locked: true, permissions: [{ key: "grades.view" }] }];
    it("a good entry has no problems", () => assert.deepEqual(validateRevocations([REV], templates), []));
    it("refuses: a permission the template still lists (the sync would add it back)", () => {
        const p = validateRevocations([{ ...REV, permissions: ["school.view"] }], templates);
        assert.equal(p.length, 1); assert.match(p[0], /still lists "school.view"/);
    });
    it("refuses: a locked template, an unknown template, no permissions, no reason, duplicate id", () => {
        assert.match(validateRevocations([{ ...REV, id: "a", templateKey: "student" }], templates).join(), /locked/);
        assert.match(validateRevocations([{ ...REV, id: "b", templateKey: "nope" }], templates).join(), /unknown template/);
        assert.match(validateRevocations([{ ...REV, id: "c", permissions: [] }], templates).join(), /no permissions/);
        assert.match(validateRevocations([{ ...REV, id: "d", reason: " " }], templates).join(), /reason/);
        assert.match(validateRevocations([REV, REV], templates).join(), /used twice/);
    });
});

describe("planRoleRevocations: one school role", () => {
    it("untouched editable role: the named permissions go, nothing else", () => {
        assert.deepEqual(planRoleRevocations(role(), tpl(), [REV]), { type: "revoke", keys: ["school.update", "automation.manage"] });
        assert.deepEqual(planRoleRevocations(role({ grants: [g("school.view"), g("school.update")] }), tpl(), [REV]), { type: "revoke", keys: ["school.update"] });
    });
    it("a customised role is NEVER revoked: it is listed as pending with what it still holds", () => {
        assert.deepEqual(planRoleRevocations(role({ isCustomized: true }), tpl(), [REV]), { type: "pending", keys: ["school.update", "automation.manage"], reason: "customised" });
    });
    it("nothing to do when the role does not hold the permissions (repeating is harmless)", () => {
        assert.deepEqual(planRoleRevocations(role({ grants: [g("school.view")] }), tpl(), [REV]), { type: "none" });
        assert.deepEqual(planRoleRevocations(role({ grants: [g("school.view")], isCustomized: true }), tpl(), [REV]), { type: "none" }, "customised but holds nothing: not pending");
    });
    it("only the named template's roles are touched", () => {
        assert.deepEqual(planRoleRevocations(role({ sourceTemplateKey: "teacher" }), tpl({ key: "teacher" }), [REV]), { type: "none" });
    });
    it("custom roles, locked roles and roles with no source are never touched", () => {
        for (const over of [{ kind: "CUSTOM" as const }, { kind: "SYSTEM_LOCKED" as const }, { sourceTemplateKey: null }]) assert.deepEqual(planRoleRevocations(role(over), tpl(), [REV]), { type: "none" });
    });
    it("blocked until the platform template has been revoked (run order is enforced)", () => {
        assert.deepEqual(planRoleRevocations(role(), tpl({ grants: [g("school.view"), g("school.update")] }), [REV]), { type: "blocked", keys: ["school.update", "automation.manage"], reason: "template_not_revoked" });
    });
    it("no revocations at all: nothing happens (today's behaviour)", () => {
        assert.deepEqual(planRoleRevocations(role(), tpl(), []), { type: "none" });
    });
});

/* ---------- template level, with a small pretend database ---------- */
function fakePublic(extra: Record<string, string[]> = {}) {
    const rows = new Map<string, any>();
    for (const t of ROLE_TEMPLATES) rows.set(t.key, { id: t.key, key: t.key, version: 1, isLocked: t.locked, grantsAll: t.grantsAll, persona: t.persona, defaultForPersona: t.defaultForPersona ?? null, isActive: true, autoProvision: true,
        permissions: [...t.permissions.map(p => ({ permissionKey: p.key, scope: p.scope })), ...(extra[t.key] ?? []).map(k => ({ permissionKey: k, scope: "ALL" }))] });
    const calls = { deleted: [] as string[], bumped: [] as string[] };
    const api = {
        roleTemplate: {
            findUnique: async ({ where }: any) => rows.get(where.key) ?? null,
            update: async ({ where, data }: any) => { if (data.version?.increment) { rows.get(where.id).version += 1; calls.bumped.push(where.id); } },
            create: async () => { throw new Error("not expected"); },
        },
        roleTemplatePermission: {
            deleteMany: async ({ where }: any) => { const row = rows.get(where.templateId); row.permissions = row.permissions.filter((p: any) => !where.permissionKey.in.includes(p.permissionKey)); calls.deleted.push(...where.permissionKey.in); },
            createMany: async () => {}, update: async () => {},
        },
        $transaction: async (fn: any) => fn(api),
    };
    return { api: api as any, rows, calls };
}

describe("syncRoleTemplates with revocations", () => {
    const rev = { id: "demo", templateKey: "principal", permissions: ["demo.removed"], reason: "test" };
    it("removes the named permission from the editable template and raises its version once", async () => {
        const f = fakePublic({ principal: ["demo.removed"] });
        const r = await syncRoleTemplates(f.api, [rev]);
        assert.deepEqual(r.conflicts, []); assert.equal(r.revoked.length, 1); assert.match(r.revoked[0], /principal: -demo.removed \(demo\)/);
        assert.deepEqual(f.calls.deleted, ["demo.removed"]);
        assert.ok(!f.rows.get("principal").permissions.some((p: any) => p.permissionKey === "demo.removed"));
        assert.equal(f.rows.get("principal").version, 2);
    });
    it("repeating it changes nothing (no removal, no version bump)", async () => {
        const f = fakePublic({ principal: ["demo.removed"] });
        await syncRoleTemplates(f.api, [rev]);
        const again = await syncRoleTemplates(f.api, [rev]);
        assert.deepEqual(again.revoked, []); assert.equal(f.rows.get("principal").version, 2);
    });
    it("removes only what is named: the rest of the template is untouched", async () => {
        const f = fakePublic({ principal: ["demo.removed", "demo.kept"] });
        await syncRoleTemplates(f.api, [rev]);
        assert.ok(f.rows.get("principal").permissions.some((p: any) => p.permissionKey === "demo.kept"));
        assert.ok(f.rows.get("principal").permissions.some((p: any) => p.permissionKey === "school.view"));
    });
    it("a bad list is reported as a conflict and NOTHING is removed", async () => {
        const f = fakePublic({ principal: ["demo.removed"] });
        const stillListed = { ...rev, id: "bad", permissions: ["school.view"] };      // principal still lists school.view in the code
        const r = await syncRoleTemplates(f.api, [rev, stillListed]);
        assert.ok(r.conflicts.some(c => /still lists "school.view"/.test(c)));
        assert.deepEqual(f.calls.deleted, [], "not even the good entry is applied while the list is wrong");
    });
    it("a locked template cannot be revoked from", async () => {
        const f = fakePublic();
        const r = await syncRoleTemplates(f.api, [{ ...rev, id: "locked", templateKey: "student" }]);
        assert.ok(r.conflicts.some(c => /locked/.test(c)));
    });
    it("with the list as shipped, the sync reports no revocations", async () => {
        const r = await syncRoleTemplates(fakePublic().api);
        assert.deepEqual(r.revoked, []);
    });
});

/* ---------- school level, on a real schema ---------- */
describe("syncSchoolRoles with revocations (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let pool: Pool; let ids: Record<string, string>;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const templates = new Map<string, TemplateView>([["principal", tpl()], ["teacher", { ...tpl(), key: "teacher", grants: [g("classes.view", "ASSIGNED")] }]]);

    const run = async (opts: { dryRun?: boolean; revocations?: RevocationView[]; templates?: Map<string, TemplateView> }) => {
        const client = await pool.connect();
        try {
            await client.query("BEGIN"); await client.query(`SET LOCAL search_path TO "${school.schemaName}"`);
            const r = await syncSchoolRoles(client, opts.templates ?? templates, { prune: false, dryRun: !!opts.dryRun, revocations: opts.revocations ?? [REV] });
            await client.query("COMMIT"); return r;
        } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
    };
    const keysOf = (id: string) => school.run(async () => (await db().schoolRolePermission.findMany({ where: { roleId: id }, select: { permissionKey: true } })).map((p: any) => p.permissionKey).sort());
    const make = (name: string, over: Record<string, unknown>, keys: string[]) => db().schoolRole.create({ data: { name, kind: "SYSTEM_EDITABLE", sourceTemplateKey: "principal", sourceTemplateVersion: 4, isCustomized: false, ...over, permissions: { create: keys.map(k => ({ permissionKey: k, scope: "ALL" })) } } });

    before(async () => {
        school = await createTestSchool();
        pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
        ids = await school.run(async () => {
            const held = ["school.view", "school.update", "automation.manage"];
            return {
                untouched:  (await make("Principal", {}, held)).id,
                customised: (await make("Principal (our edit)", { isCustomized: true }, held)).id,
                custom:     (await make("Bursar assistant", { kind: "CUSTOM", sourceTemplateKey: null, sourceTemplateVersion: null }, held)).id,
                teacher:    (await make("Teacher", { sourceTemplateKey: "teacher" }, [...held, "classes.view"])).id,
            };
        });
    });
    after(async () => { await pool.end(); await school.drop(); });

    it("a DRY RUN reports what would happen and changes nothing", async () => {
        const r = await run({ dryRun: true });
        assert.deepEqual(r.revoked, [{ role: "Principal", keys: ["school.update", "automation.manage"] }]);
        assert.deepEqual(r.pendingRevocations, [{ role: "Principal (our edit)", keys: ["school.update", "automation.manage"] }]);
        assert.deepEqual(await keysOf(ids.untouched), ["automation.manage", "school.update", "school.view"]);
    });
    it("the real run removes the named permissions from the untouched role only", async () => {
        const r = await run({});
        assert.deepEqual(r.revoked.map(x => x.role), ["Principal"]);
        assert.deepEqual(await keysOf(ids.untouched), ["school.view"], "named permissions gone, the rest kept");
        assert.deepEqual(await keysOf(ids.customised), ["automation.manage", "school.update", "school.view"], "the customised role is untouched");
        assert.deepEqual(await keysOf(ids.custom), ["automation.manage", "school.update", "school.view"], "a custom role is untouched");
        assert.deepEqual(await keysOf(ids.teacher), ["automation.manage", "classes.view", "school.update", "school.view"], "another template's role is untouched");
    });
    it("the customised role is listed as pending, so that school can be handled on purpose", async () => {
        const r = await run({});
        assert.deepEqual(r.pendingRevocations, [{ role: "Principal (our edit)", keys: ["school.update", "automation.manage"] }]);
        assert.deepEqual(r.revoked, [], "nothing left to remove: repeating is harmless");
    });
    it("a permission the school later gives back (the role then counts as customised) is not taken away again", async () => {
        await school.run(() => db().schoolRolePermission.create({ data: { roleId: ids.untouched, permissionKey: "school.update", scope: "ALL" } }));
        await school.run(() => db().schoolRole.update({ where: { id: ids.untouched }, data: { isCustomized: true } }));
        const r = await run({});
        assert.deepEqual(r.revoked, []);
        assert.ok((await keysOf(ids.untouched)).includes("school.update"));
        assert.deepEqual(r.pendingRevocations.map(x => x.role).sort(), ["Principal", "Principal (our edit)"]);
    });
    it("blocked, and nothing removed, while the platform template still holds the permission", async () => {
        await school.run(() => db().schoolRole.update({ where: { id: ids.untouched }, data: { isCustomized: false } }));
        const blockedTemplates = new Map(templates); blockedTemplates.set("principal", tpl({ grants: [g("school.view"), g("school.update")] }));
        const r = await run({ templates: blockedTemplates });
        assert.deepEqual(r.blockedRevocations.map(x => x.role), ["Principal"]);
        assert.ok((await keysOf(ids.untouched)).includes("school.update"));
    });
    it("with no revocations in the list, the sync behaves exactly as before (nothing revoked, nothing pending)", async () => {
        const r = await run({ revocations: [] });
        assert.deepEqual([r.revoked, r.pendingRevocations, r.blockedRevocations], [[], [], []]);
    });
});
