import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guardianScopeWhere, guardianChildrenWhere } from "../../src/modules/guardians/services/guardian-scope";
import { ListGuardiansUseCase, GetGuardianUseCase } from "../../src/modules/guardians/usecases/guardian-queries.usecases";
import { GUARDIAN_PERMISSIONS } from "../../src/modules/guardians/guardians.permissions";

const NORTH = "north", MAIN = "main";
const who = (scope: string | null, branches: string[] = []): any => ({ scopeOf: () => scope, branchScope: () => branches, persona: "STAFF", personaEntityId: "s1" });

describe("guardians by branch", () => {
    it("guardians.view allows BRANCH; guardians.manage stays school-wide only", () => {
        assert.deepEqual([...GUARDIAN_PERMISSIONS.find(p => p.key === "guardians.view")!.scopes], ["ALL", "BRANCH"]);
        assert.deepEqual([...GUARDIAN_PERMISSIONS.find(p => p.key === "guardians.manage")!.scopes], ["ALL"]);
    });
    it("ALL sees every guardian; BRANCH sees guardians of students in their branches; nothing else sees nobody", () => {
        assert.deepEqual(guardianScopeWhere(who("ALL")), {});
        assert.deepEqual(guardianScopeWhere(who("BRANCH", [NORTH])), { studentLinks: { some: { student: { branchId: { in: [NORTH] } } } } });
        assert.deepEqual(guardianScopeWhere(who(null)), { id: { in: [] } });
    });
    it("'guardians of this student' only counts a student inside your branches (no peeking at other branches' families)", () => {
        assert.deepEqual(guardianScopeWhere(who("ALL"), "st1"), { studentLinks: { some: { studentId: "st1" } } });
        assert.deepEqual(guardianScopeWhere(who("BRANCH", [NORTH]), "st1"), { studentLinks: { some: { studentId: "st1", student: { branchId: { in: [NORTH] } } } } });
    });
    it("on a guardian's page a branch viewer sees only the children of their own branches", () => {
        assert.deepEqual(guardianChildrenWhere(who("BRANCH", [NORTH, MAIN])), { branchId: { in: [NORTH, MAIN] } });
        assert.deepEqual(guardianChildrenWhere(who("ALL")), {});
        assert.deepEqual(guardianChildrenWhere({ scopeOf: () => null } as any), {});          // a guardian looking at their own children
    });
    it("the list and a single guardian are limited by the scope; out of scope looks like not found", async () => {
        const seen: any = {};
        const d: any = {
            guardianRepository: { paginate: async (p: any) => { seen.list = p.where; return { data: [], meta: {} }; }, findOne: async (w: any) => { seen.one = w; return null; } },
            guardianMapper: {},
        };
        await new ListGuardiansUseCase(d).execute({ page: 1, limit: 20 } as any, who("BRANCH", [NORTH]));
        assert.deepEqual(seen.list, { studentLinks: { some: { student: { branchId: { in: [NORTH] } } } } });
        await assert.rejects(new GetGuardianUseCase(d).execute("g1", who("BRANCH", [NORTH])), { code: "NOT_FOUND" });
        assert.deepEqual(seen.one, { AND: [{ id: "g1" }, { studentLinks: { some: { student: { branchId: { in: [NORTH] } } } } }] });
    });
});
