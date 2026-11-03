import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { studentScopeWhere } from "../../src/modules/students/services/student-scope";
import { resolveNewStudentBranch, requireUsableBranch, branchNames } from "../../src/modules/students/services/student-branch";
import { CreateStudentDto, UpdateStudentDto, ListStudentsQuery } from "../../src/modules/students/dtos/student.dto";
import { STUDENT_PERMISSIONS } from "../../src/modules/students/students.permissions";

const MAIN = "11111111-1111-4111-8111-111111111111", NORTH = "22222222-2222-4222-8222-222222222222", GONE = "33333333-3333-4333-8333-333333333333";
// A tiny stand-in for the tenant database
const fakeDb = (own: string[] = []): any => {
    const branches: Record<string, any> = {
        [MAIN]: { id: MAIN, name: "Main", isActive: true, deletedAt: null }, [NORTH]: { id: NORTH, name: "North", isActive: true, deletedAt: null },
        [GONE]: { id: GONE, name: "Old", isActive: false, deletedAt: null },
    };
    return {
        branch: {
            findUnique: async ({ where }: any) => branches[where.id] ?? null,
            findFirst: async () => ({ id: MAIN }),
            findMany: async ({ where }: any) => where.id.in.map((i: string) => branches[i]).filter(Boolean),
        },
        staffBranch: { findMany: async () => own.map(branchId => ({ branchId })) },
    };
};

describe("students and branches", () => {
    it("the branch scope shows the students whose own branch is yours (a new student with no class is visible at once)", () => {
        const a: any = { scopeOf: () => "BRANCH", branchScope: () => [NORTH], persona: "STAFF", personaEntityId: "s1" };
        assert.deepEqual(studentScopeWhere(a), { branchId: { in: [NORTH] } });
        assert.deepEqual(studentScopeWhere({ ...a, branchScope: () => [] }), { branchId: { in: [] } });
    });
    it("students.view allows BRANCH, and students.transfer is school-wide only", () => {
        assert.ok(STUDENT_PERMISSIONS.find(p => p.key === "students.view")!.scopes.includes("BRANCH" as never));
        const t = STUDENT_PERMISSIONS.find(p => p.key === "students.transfer")!;
        assert.deepEqual([...t.scopes], ["ALL"]); assert.equal((t as any).isSensitive, true);
    });
    it("a new student goes to the branch asked for, else the creator's only branch, else the main branch", async () => {
        assert.equal((await resolveNewStudentBranch(NORTH, null, fakeDb())).id, NORTH);
        assert.equal((await resolveNewStudentBranch(undefined, "staff1", fakeDb([NORTH]))).id, NORTH);
        assert.equal((await resolveNewStudentBranch(undefined, "staff1", fakeDb([NORTH, MAIN]))).id, MAIN);   // two branches: not a guess, use main
        assert.equal((await resolveNewStudentBranch(undefined, null, fakeDb())).id, MAIN);
    });
    it("an unknown or inactive branch is refused", async () => {
        await assert.rejects(requireUsableBranch(GONE, fakeDb()), { code: "STUDENT_BRANCH_INVALID" });
        await assert.rejects(resolveNewStudentBranch("44444444-4444-4444-8444-444444444444", null, fakeDb()), { code: "STUDENT_BRANCH_INVALID" });
    });
    it("branch names are read in one lookup, and nothing is asked when there are no students", async () => {
        assert.deepEqual([...(await branchNames([MAIN, NORTH, MAIN], fakeDb()))], [[MAIN, "Main"], [NORTH, "North"]]);
        assert.equal((await branchNames([], { branch: { findMany: () => { throw new Error("should not be called"); } } } as any)).size, 0);
    });
    it("create and list accept a branch; update does NOT (a student changes branch only by transfer)", () => {
        assert.equal(CreateStudentDto.parse({ firstName: "Ada", lastName: "Obi", branchId: NORTH }).branchId, NORTH);
        assert.throws(() => CreateStudentDto.parse({ firstName: "Ada", lastName: "Obi", branchId: "not-a-uuid" }));
        assert.equal(ListStudentsQuery.parse({ branchId: NORTH }).branchId, NORTH);
        assert.throws(() => UpdateStudentDto.parse({ branchId: NORTH }));
    });
});
