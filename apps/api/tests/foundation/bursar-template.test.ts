/*
| THE BURSAR DEFAULT ROLE: bills and collects. Finds a student with students.lookup, sees head-counts on the dashboard,
| and no longer opens the full student record or class lists. The change reaches existing schools through the real
| revocation entry, never forced onto a role the school has customised.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { ROLE_REVOCATIONS } from "../../src/foundation/role-revocations.registry";
import { validateRevocations, type TemplateView } from "../../src/foundation/role-grants.planner";
import { syncSchoolRoles } from "../../src/foundation/sync-school-roles";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";

const bursar = ROLE_TEMPLATES.find(t => t.key === "bursar")!;
const has = (k: string) => bursar.permissions.some(p => p.key === k);
const ENTRY = ROLE_REVOCATIONS.find(r => r.id === "2026-11-bursar-student-record-to-lookup")!;

describe("bursar default role", () => {
    it("finds students and sees head-counts, but not the student record or class lists", () => {
        assert.equal(has("students.lookup"), true); assert.equal(has("school.dashboard.counts"), true);
        assert.equal(has("students.view"), false); assert.equal(has("enrolment.view"), false);
    });
    it("keeps everything billing needs: classes and sessions to set up fees, the dashboard, and the money permissions", () => {
        for (const k of ["classes.view", "sessions.view", "school.view", "school.dashboard.view", "fees.view", "fees.invoices.view", "payments.view", "expenses.view"]) assert.equal(has(k), true, k);
    });
    it("the revocation entry names exactly the two permissions, and the whole list is valid", () => {
        assert.ok(ENTRY, "entry exists"); assert.deepEqual([...ENTRY.permissions].sort(), ["enrolment.view", "students.view"]);
        assert.deepEqual(validateRevocations(ROLE_REVOCATIONS, ROLE_TEMPLATES.map(t => ({ key: t.key, locked: t.locked, permissions: t.permissions }))), []);
    });
});

describe("the real bursar revocation on a real school schema", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let pool: Pool; let ids: Record<string, string>;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const template: TemplateView = { key: "bursar", version: 9, isActive: true, grantsAll: false, grants: bursar.permissions.map(p => ({ key: p.key, scope: p.scope })) };
    const run = async (dryRun: boolean) => {
        const c = await pool.connect();
        try { await c.query("BEGIN"); await c.query(`SET LOCAL search_path TO "${school.schemaName}"`);
            const r = await syncSchoolRoles(c, new Map([["bursar", template]]), { prune: false, dryRun }); await c.query("COMMIT"); return r;
        } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
    };
    const keysOf = (id: string) => school.run(async () => (await db().schoolRolePermission.findMany({ where: { roleId: id }, select: { permissionKey: true } })).map((p: any) => p.permissionKey).sort());
    const make = (name: string, isCustomized: boolean) => db().schoolRole.create({ data: { name, kind: "SYSTEM_EDITABLE", sourceTemplateKey: "bursar", sourceTemplateVersion: 8, isCustomized, permissions: { create: ["fees.view", "students.view", "enrolment.view", "students.lookup"].map(k => ({ permissionKey: k, scope: "ALL" })) } } });

    before(async () => {
        school = await createTestSchool(); pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
        ids = await school.run(async () => ({ untouched: (await make("Bursar", false)).id, customised: (await make("Bursar (our changes)", true)).id }));
    });
    after(async () => { await pool.end(); await school.drop(); });

    it("a dry run lists who loses what and who is pending, and writes nothing", async () => {
        const r = await run(true);
        assert.deepEqual(r.revoked, [{ role: "Bursar", keys: ["students.view", "enrolment.view"] }]);
        assert.deepEqual(r.pendingRevocations, [{ role: "Bursar (our changes)", keys: ["students.view", "enrolment.view"] }]);
        assert.deepEqual(await keysOf(ids.untouched), ["enrolment.view", "fees.view", "students.lookup", "students.view"]);
    });
    it("the real run: the untouched bursar loses both and keeps the rest; the customised one is left exactly as the school had it", async () => {
        await run(false);
        const untouched = await keysOf(ids.untouched);
        assert.ok(!untouched.includes("students.view") && !untouched.includes("enrolment.view"), "both removed");
        for (const k of ["fees.view", "students.lookup"]) assert.ok(untouched.includes(k), `${k} kept`);
        assert.ok(untouched.includes("school.dashboard.counts"), "the normal sync also adds what the template gained");
        assert.deepEqual(await keysOf(ids.customised), ["enrolment.view", "fees.view", "students.lookup", "students.view"], "customised: not one permission added or removed");
    });
    it("the customised school stays on the pending list, run after run, until someone decides", async () => {
        const r = await run(false);
        assert.deepEqual(r.pendingRevocations.map(x => x.role), ["Bursar (our changes)"]); assert.deepEqual(r.revoked, []);
    });
});
