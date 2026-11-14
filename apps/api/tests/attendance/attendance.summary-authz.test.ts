/* REM-001: the student summary shows nothing about a student the person may not see (they look like they do not exist). No database needed. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { studentInScope } from "../../src/modules/attendance/services/attendance-scope";
import { StudentSummaryUseCase } from "../../src/modules/attendance/usecases/attendance-summaries.usecases";

const acc = (persona: any, id: string | null, perms: Record<string, any>) => new Access("school", "u", "m", persona, id, new Set(), false, new Map(Object.entries(perms)));
const T = "term-1";

function repoFake(o: { enrolled?: boolean; linked?: boolean } = {}) {
    const calls: string[] = []; const filters: any[] = [];
    return { calls, filters, repo: {
        enrolledWithin: async (where: any) => { calls.push("enrolledWithin"); filters.push(where); return !!o.enrolled; },
        guardianLinked: async () => { calls.push("guardianLinked"); return !!o.linked; },
    } as any };
}

describe("studentInScope", () => {
    it("ALL sees every student, without asking the database", async () => {
        const f = repoFake(); assert.equal(await studentInScope(f.repo, acc("STAFF", "s", { "attendance.view": "ALL" }), "st1", T), true); assert.deepEqual(f.calls, []);
    });
    it("a student sees only themselves; a guardian only a linked child", async () => {
        assert.equal(await studentInScope(repoFake().repo, acc("STUDENT", "st1", { "attendance.view": "OWN" }), "st1", T), true);
        assert.equal(await studentInScope(repoFake().repo, acc("STUDENT", "st1", { "attendance.view": "OWN" }), "st2", T), false);
        assert.equal(await studentInScope(repoFake({ linked: true }).repo, acc("GUARDIAN", "g1", { "attendance.view": "OWN" }), "st1", T), true);
        assert.equal(await studentInScope(repoFake({ linked: false }).repo, acc("GUARDIAN", "g1", { "attendance.view": "OWN" }), "st9", T), false);
    });
    it("a teacher (ASSIGNED): only a student on the list of a class they lead, or teach this term; the same filter the lists use", async () => {
        const yes = repoFake({ enrolled: true }), no = repoFake({ enrolled: false });
        assert.equal(await studentInScope(yes.repo, acc("STAFF", "t1", { "attendance.view": "ASSIGNED" }), "st1", T), true);
        assert.equal(await studentInScope(no.repo, acc("STAFF", "t1", { "attendance.view": "ASSIGNED" }), "st4", T), false);
        assert.equal(JSON.stringify(yes.filters[0]).includes('"classTeacherId":"t1"'), true);
    });
    it("everyone else sees nobody: no permission, OWN without an identity, a wrong persona", async () => {
        const f = repoFake({ enrolled: true, linked: true });
        assert.equal(await studentInScope(f.repo, acc("STAFF", "x", {}), "st1", T), false);
        assert.equal(await studentInScope(f.repo, acc("STUDENT", null, { "attendance.view": "OWN" }), "st1", T), false);
        assert.equal(await studentInScope(f.repo, acc("STAFF", "x", { "attendance.view": "OWN" }), "st1", T), false);
        assert.equal(await studentInScope(f.repo, acc("GUARDIAN", "g", { "attendance.view": "ASSIGNED" }), "st1", T), false);
    });
});

describe("StudentSummaryUseCase", () => {
    function world(inScope: boolean) {
        const calls: string[] = [];
        const repo: any = {
            allTerms: async () => [{ id: T, name: "first", isCurrent: true, startDate: new Date(), endDate: new Date(), session: null }],
            findStudent: async (id: string) => ({ id, firstName: "Ada", lastName: "Pupil", admissionNumber: null }),
            enrolledWithin: async () => inScope, guardianLinked: async () => inScope,
            statusCounts: async () => { calls.push("statusCounts"); return []; },
            studentClassIn: async () => { calls.push("studentClassIn"); return { classId: "c1", class: { id: "c1", name: "JSS 1A" } }; },
            registerDays: async () => { calls.push("registerDays"); return 5; },
        };
        return { uc: new StudentSummaryUseCase({ attendanceRepository: repo }), calls };
    }
    it("a student outside the person's reach is a plain 404 and no class, register days or counts are looked up", async () => {
        const w = world(false);
        await assert.rejects(w.uc.execute({ studentId: "other" } as any, acc("GUARDIAN", "g1", { "attendance.view": "OWN" })), { statusCode: 404 });
        assert.deepEqual(w.calls, []);
    });
    it("a visible student gets the full summary", async () => {
        const w = world(true);
        const r: any = await w.uc.execute({ studentId: "st1" } as any, acc("STAFF", "a", { "attendance.view": "ALL" }));
        assert.equal(r.student.name, "Ada Pupil"); assert.equal(r.class.name, "JSS 1A"); assert.equal(r.registerDays, 5);
    });
});
