/*
| StaffPortalService.listStaffRoles on a real database: it feeds GET /staff/assignable-roles, so it must return
| only THIS school's live STAFF-persona roles and never reach into another school.
| Two schools are built (two separate Postgres schemas) with overlapping role names, so a leak could not hide:
| "Shared Name" exists in both with different permissions, and each school must see only its own.
| Skipped without TEST_DATABASE_URL (see docs/TESTING_GUIDE.md).
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { StaffPortalService } from "../../src/modules/staff/services/staff-portal.service";

type Seed = { name: string; kind: "SYSTEM_LOCKED" | "SYSTEM_EDITABLE" | "CUSTOM"; persona?: "STAFF" | "STUDENT" | "GUARDIAN"; grantsAll?: boolean; deleted?: boolean; perms?: Array<[string, "ALL" | "BRANCH" | "ASSIGNED" | "OWN"]> };

const SCHOOL_A: Seed[] = [
    { name: "Administrator",  kind: "SYSTEM_LOCKED",   grantsAll: true },
    { name: "Teacher",        kind: "SYSTEM_EDITABLE", perms: [["students.view", "OWN"], ["attendance.mark", "ASSIGNED"]] },
    { name: "Bursar",         kind: "CUSTOM",          perms: [["fees.view", "ALL"]] },
    { name: "Shared Name",    kind: "CUSTOM",          perms: [["students.view", "ALL"]] },
    { name: "Retired",        kind: "CUSTOM",          deleted: true, perms: [["fees.view", "ALL"]] },
    { name: "Student",        kind: "SYSTEM_LOCKED",   persona: "STUDENT" },
    { name: "Guardian",       kind: "SYSTEM_LOCKED",   persona: "GUARDIAN" },
];
const SCHOOL_B: Seed[] = [
    { name: "Administrator",     kind: "SYSTEM_LOCKED", grantsAll: true },
    { name: "Shared Name",       kind: "CUSTOM",        perms: [["fees.collect", "BRANCH"]] },
    { name: "Other School Only", kind: "CUSTOM",        perms: [["payroll.view", "ALL"]] },
    { name: "B Retired",         kind: "CUSTOM",        deleted: true },
    { name: "B Guardian",        kind: "SYSTEM_LOCKED", persona: "GUARDIAN" },
];

describe("StaffPortalService.listStaffRoles (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let a: TestSchool;
    let b: TestSchool;
    let idsA: Map<string, string>;   // seeded role name -> id, per school
    let idsB: Map<string, string>;
    const service = () => new StaffPortalService({ prismaClient: {} as any });
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();

    async function seedRoles(school: TestSchool, roles: Seed[]): Promise<Map<string, string>> {
        return school.run(async () => {
            const out = new Map<string, string>();
            for (const r of roles) {
                const row = await db().schoolRole.create({
                    data: {
                        name: r.name, kind: r.kind, persona: r.persona ?? "STAFF", grantsAll: r.grantsAll ?? false,
                        deletedAt: r.deleted ? new Date() : null,
                        permissions: { create: (r.perms ?? []).map(([permissionKey, scope]) => ({ permissionKey, scope })) },
                    },
                    select: { id: true },
                });
                out.set(r.name, row.id);
            }
            return out;
        });
    }

    before(async () => {
        a = await createTestSchool();
        b = await createTestSchool();
        idsA = await seedRoles(a, SCHOOL_A);
        idsB = await seedRoles(b, SCHOOL_B);
    });
    after(async () => { await a.drop(); await b.drop(); });

    const listIn = (school: TestSchool) => school.run(() => service().listStaffRoles());
    const sortedPerms = (r: { permissions: Array<{ key: string; scope: string }> }) => [...r.permissions].sort((x, y) => x.key.localeCompare(y.key));

    it("returns only the current school's live STAFF roles, system roles first then by name", async () => {
        const rows = await listIn(a);
        assert.deepEqual(rows.map(r => r.name), ["Administrator", "Teacher", "Bursar", "Shared Name"]);
        assert.deepEqual(rows.map(r => r.id), ["Administrator", "Teacher", "Bursar", "Shared Name"].map(n => idsA.get(n)));
    });

    it("leaves out soft-deleted roles and student / guardian roles", async () => {
        const names = (await listIn(a)).map(r => r.name);
        for (const hidden of ["Retired", "Student", "Guardian"]) assert.ok(!names.includes(hidden), `${hidden} must not be listed`);
        const namesB = (await listIn(b)).map(r => r.name);
        for (const hidden of ["B Retired", "B Guardian"]) assert.ok(!namesB.includes(hidden), `${hidden} must not be listed`);
    });

    it("does not expose another school's roles, in either direction", async () => {
        const inA = await listIn(a);
        const inB = await listIn(b);
        assert.deepEqual(inB.map(r => r.name), ["Administrator", "Other School Only", "Shared Name"]);
        const idsOfA = new Set(idsA.values());
        const idsOfB = new Set(idsB.values());
        assert.ok(inA.every(r => idsOfA.has(r.id)) && !inA.some(r => idsOfB.has(r.id)), "school A lists only school A ids");
        assert.ok(inB.every(r => idsOfB.has(r.id)) && !inB.some(r => idsOfA.has(r.id)), "school B lists only school B ids");
        assert.ok(!inA.some(r => r.name === "Other School Only"), "a role that exists only in B never shows in A");
    });

    it("a role with the same name in both schools comes back with that school's own permissions", async () => {
        const sharedA = (await listIn(a)).find(r => r.name === "Shared Name")!;
        const sharedB = (await listIn(b)).find(r => r.name === "Shared Name")!;
        assert.notEqual(sharedA.id, sharedB.id);
        assert.deepEqual(sharedA.permissions, [{ key: "students.view", scope: "ALL" }]);
        assert.deepEqual(sharedB.permissions, [{ key: "fees.collect", scope: "BRANCH" }]);
    });

    it("returns each role's kind, grantsAll and permissions (key and scope)", async () => {
        const rows = await listIn(a);
        const byName = new Map(rows.map(r => [r.name, r]));
        assert.equal(byName.get("Administrator")!.grantsAll, true);
        assert.equal(byName.get("Administrator")!.kind, "SYSTEM_LOCKED");
        assert.equal(byName.get("Teacher")!.grantsAll, false);
        assert.equal(byName.get("Teacher")!.kind, "SYSTEM_EDITABLE");
        assert.deepEqual(sortedPerms(byName.get("Teacher")!), [{ key: "attendance.mark", scope: "ASSIGNED" }, { key: "students.view", scope: "OWN" }]);
        assert.deepEqual(byName.get("Administrator")!.permissions, []);
    });

    it("switching schools back and forth never carries results over", async () => {
        const first  = (await listIn(a)).map(r => r.name);
        await listIn(b);
        const second = (await listIn(a)).map(r => r.name);
        assert.deepEqual(second, first);
    });

    it("refuses to run outside a school context instead of falling back to some shared schema", async () => {
        await assert.rejects(() => service().listStaffRoles(), /tenant context/i);
    });
});
