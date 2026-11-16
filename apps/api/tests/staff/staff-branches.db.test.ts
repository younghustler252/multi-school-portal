/*
| StaffRepositoryImpl.listActiveBranches on a real database: it feeds GET /staff/assignable-branches, so it must return
| only THIS school's active, not-deleted branches (optionally only the ids asked for) and never reach into another school.
| Two schools are built (two separate Postgres schemas) with overlapping branch names, and school B's ids are asked for
| from school A, so a leak could not hide.
| Skipped without TEST_DATABASE_URL (see docs/TESTING_GUIDE.md).
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { getTenantClient } from "../../src/infrastructure/database/prisma/prisma.client";
import { StaffRepositoryImpl } from "../../src/modules/staff/repositories/staff.repository.impl";

type Seed = { name: string; code: string; isMain?: boolean; isActive?: boolean; deleted?: boolean };

const SCHOOL_A: Seed[] = [
    { name: "Zion Campus", code: "ZN" },
    { name: "Main Campus", code: "MN", isMain: true },
    { name: "Annex",       code: "AN" },
    { name: "Closed",      code: "CL", isActive: false },
    { name: "Removed",     code: "RM", deleted: true },
];
const SCHOOL_B: Seed[] = [
    { name: "Main Campus",    code: "MN", isMain: true },
    { name: "Annex",          code: "AN" },
    { name: "Other School Only", code: "OS" },
    { name: "B Closed",       code: "BC", isActive: false },
];

describe("StaffRepositoryImpl.listActiveBranches (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let a: TestSchool;
    let b: TestSchool;
    let idsA: Map<string, string>;   // seeded branch name -> id, per school
    let idsB: Map<string, string>;
    const repo = () => new StaffRepositoryImpl({ staffMapper: {} as any });

    async function seed(school: TestSchool, branches: Seed[]): Promise<Map<string, string>> {
        return school.run(async () => {
            const out = new Map<string, string>();
            for (const s of branches) {
                const row = await getTenantClient().branch.create({
                    data: { name: s.name, code: s.code, isMain: s.isMain ?? false, isActive: s.isActive ?? true, deletedAt: s.deleted ? new Date() : null },
                    select: { id: true },
                });
                out.set(s.name, row.id);
            }
            return out;
        });
    }

    before(async () => {
        a = await createTestSchool();
        b = await createTestSchool();
        idsA = await seed(a, SCHOOL_A);
        idsB = await seed(b, SCHOOL_B);
    });
    after(async () => { await a.drop(); await b.drop(); });

    const listIn = (school: TestSchool, ids?: string[]) => school.run(() => repo().listActiveBranches(ids));

    it("returns the school's active, not-deleted branches, main first then by name", async () => {
        const rows = await listIn(a);
        assert.deepEqual(rows.map(r => r.name), ["Main Campus", "Annex", "Zion Campus"]);
        assert.deepEqual(rows.map(r => r.id), ["Main Campus", "Annex", "Zion Campus"].map(n => idsA.get(n)));
    });

    it("leaves out inactive and soft-deleted branches", async () => {
        const names = (await listIn(a)).map(r => r.name);
        assert.ok(!names.includes("Closed") && !names.includes("Removed"));
        assert.ok(!(await listIn(b)).some(r => r.name === "B Closed"));
    });

    it("returns only id, name, code and isMain", async () => {
        const [main] = await listIn(a);
        assert.deepEqual(Object.keys(main).sort(), ["code", "id", "isMain", "name"]);
        assert.deepEqual(main, { id: idsA.get("Main Campus"), name: "Main Campus", code: "MN", isMain: true });
    });

    it("with ids, returns only those of them that are active (a closed or deleted one is dropped)", async () => {
        const rows = await listIn(a, [idsA.get("Annex")!, idsA.get("Closed")!, idsA.get("Removed")!, "no-such-id"]);
        assert.deepEqual(rows.map(r => r.name), ["Annex"]);
    });

    it("with an empty id list, returns nothing (an empty filter is not 'every branch')", async () => {
        assert.deepEqual(await listIn(a, []), []);
    });

    it("does not expose another school's branches, in either direction", async () => {
        const inA = await listIn(a);
        const inB = await listIn(b);
        assert.deepEqual(inB.map(r => r.name), ["Main Campus", "Annex", "Other School Only"]);
        const idsOfA = new Set(idsA.values());
        const idsOfB = new Set(idsB.values());
        assert.ok(inA.every(r => idsOfA.has(r.id)) && !inA.some(r => idsOfB.has(r.id)), "school A lists only school A ids");
        assert.ok(inB.every(r => idsOfB.has(r.id)) && !inB.some(r => idsOfA.has(r.id)), "school B lists only school B ids");
        assert.ok(!inA.some(r => r.name === "Other School Only"));
    });

    it("asking school A for school B's branch ids returns nothing", async () => {
        assert.deepEqual(await listIn(a, [...idsB.values()]), []);
    });

    it("same-named branches in both schools come back with their own ids", async () => {
        const mainA = (await listIn(a)).find(r => r.name === "Main Campus")!;
        const mainB = (await listIn(b)).find(r => r.name === "Main Campus")!;
        assert.notEqual(mainA.id, mainB.id);
        assert.equal(mainA.id, idsA.get("Main Campus"));
        assert.equal(mainB.id, idsB.get("Main Campus"));
    });

    it("refuses to run outside a school context instead of falling back to some shared schema", async () => {
        await assert.rejects(() => repo().listActiveBranches(), /tenant context/i);
    });
});
