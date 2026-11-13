/* REM-001: the student summary authorizes the TARGET student before looking anything up about them. No database needed. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { studentViewWhere } from "../../src/modules/attendance/services/attendance-scope";
import { StudentSummaryUseCase } from "../../src/modules/attendance/usecases/attendance-summaries.usecases";

const acc = (persona: any, id: string | null, perms: Record<string, any>) => new Access("school", "u", "m", persona, id, new Set(), false, new Map(Object.entries(perms)));
const T = "term-1";

describe("studentViewWhere: who may see which students", () => {
    it("ALL sees everyone (no filter)", () => assert.deepEqual(studentViewWhere(acc("STAFF", "s", { "attendance.view": "ALL" }), T), {}));
    it("a student: only themselves; a guardian: only linked children", () => {
        assert.deepEqual(studentViewWhere(acc("STUDENT", "st1", { "attendance.view": "OWN" }), T), { id: "st1" });
        assert.deepEqual(studentViewWhere(acc("GUARDIAN", "g1", { "attendance.view": "OWN" }), T), { guardianLinks: { some: { guardianId: "g1" } } });
    });
    it("a teacher: students enrolled THIS TERM in a class they lead, or whose subject they teach this (current) term", () => {
        const w: any = studentViewWhere(acc("STAFF", "t1", { "attendance.view": "ASSIGNED" }), T);
        assert.equal(w.enrolments.some.termId, T);
        assert.deepEqual(w.enrolments.some.class.OR, [{ classTeacherId: "t1" }, { classSubjects: { some: { staffId: "t1", termId: T, term: { isCurrent: true } } } }]);
    });
    it("everyone else (no permission, BRANCH, OWN without an identity, wrong persona) sees nobody", () => {
        const nobody = { id: { in: [] } };
        assert.deepEqual(studentViewWhere(acc("STAFF", "x", {}), T), nobody);
        assert.deepEqual(studentViewWhere(acc("STAFF", "x", { "attendance.view": "BRANCH" }), T), nobody);
        assert.deepEqual(studentViewWhere(acc("STUDENT", null, { "attendance.view": "OWN" }), T), nobody);
        assert.deepEqual(studentViewWhere(acc("STAFF", "x", { "attendance.view": "OWN" }), T), nobody);
        assert.deepEqual(studentViewWhere(acc("GUARDIAN", "g", { "attendance.view": "ASSIGNED" }), T), nobody);
    });
});

describe("StudentSummaryUseCase", () => {
    function world(visible: boolean) {
        const calls: string[] = []; const seen: any[] = [];
        const repo: any = {
            allTerms: async () => [{ id: T, name: "first", isCurrent: true, startDate: new Date(), endDate: new Date(), session: null }],
            findVisibleStudent: async (id: string, where: any) => { calls.push("findVisibleStudent"); seen.push(where); return visible ? { id, firstName: "Ada", lastName: "Pupil", admissionNumber: null } : null; },
            findStudent: async () => { calls.push("findStudent"); return { id: "x" }; },
            statusCounts: async () => { calls.push("statusCounts"); return []; },
            studentClassIn: async () => { calls.push("studentClassIn"); return { classId: "c1", class: { id: "c1", name: "JSS 1A" } }; },
            registerDays: async () => { calls.push("registerDays"); return 5; },
        };
        return { uc: new StudentSummaryUseCase({ attendanceRepository: repo }), calls, seen };
    }
    it("a student the person may not see is a plain 404 and NOTHING else about them is looked up", async () => {
        const w = world(false);
        await assert.rejects(w.uc.execute({ studentId: "other" } as any, acc("GUARDIAN", "g1", { "attendance.view": "OWN" })), { statusCode: 404 });
        assert.deepEqual(w.calls, ["findVisibleStudent"]);                       // no class, no register days, no counts
        assert.deepEqual(w.seen[0], { guardianLinks: { some: { guardianId: "g1" } } });
    });
    it("a visible student gets the full summary (class, register days, counts)", async () => {
        const w = world(true);
        const r: any = await w.uc.execute({ studentId: "st1" } as any, acc("STAFF", "a", { "attendance.view": "ALL" }));
        assert.equal(r.student.name, "Ada Pupil"); assert.equal(r.class.name, "JSS 1A"); assert.equal(r.registerDays, 5);
        assert.ok(!w.calls.includes("findStudent"));                             // the unfiltered lookup is no longer used here
    });
    it("an unknown term is refused before any student lookup", async () => {
        const w = world(true);
        await assert.rejects(w.uc.execute({ studentId: "st1", termId: "nope" } as any, acc("STAFF", "a", { "attendance.view": "ALL" })));
        assert.deepEqual(w.calls, []);
    });
});
