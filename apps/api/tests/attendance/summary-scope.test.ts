/*
| Attendance summaries only ever contain what the viewer's attendance.view scope allows (REM-001 follow-up, Nov 2026).
| A small in-memory school runs the REAL scope filters (attendanceViewWhere / classInScope / studentInScope) through a mini evaluator of the
| Prisma-style filters they produce, over the REAL summary use cases and the REAL dashboard use case. No database needed.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { StudentSummaryUseCase, ClassSummaryUseCase } from "../../src/modules/attendance/usecases/attendance-summaries.usecases";
import { attendanceViewWhere } from "../../src/modules/attendance/services/attendance-scope";
import { GetDashboardUseCase } from "../../src/modules/school/usecases/get-dashboard.usecase";

const acc = (persona: any, id: string | null, perms: Record<string, any>, branches?: string[]) =>
    new Access("school", "u", "m", persona, id, new Set(), false, new Map(Object.entries(perms)), new Set(branches ?? []));

/* ── the school ── */
const TERM_NOW = "t1", TERM_OLD = "t0";
const terms = [{ id: TERM_NOW, name: "Second", isCurrent: true, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), session: null }, { id: TERM_OLD, name: "First", isCurrent: false, startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), session: null }];
const subj = (classId: string, staffId: string, termId: string) => ({ classId, staffId, termId, term: { isCurrent: termId === TERM_NOW } });
const classes: Record<string, any> = {
    A: { id: "A", name: "JSS 1A", classTeacherId: "T1", branchId: "b1", classSubjects: [subj("A", "T1", TERM_NOW)] },
    B: { id: "B", name: "JSS 2B", classTeacherId: "T2", branchId: "b2", classSubjects: [subj("B", "T3", TERM_NOW)] },
    C: { id: "C", name: "SS 1C",  classTeacherId: "T4", branchId: "b1", classSubjects: [subj("C", "T3", TERM_OLD)] },   // T3 taught C only last term
};
const students: Record<string, any> = {
    s1: { id: "s1", firstName: "Ada",  lastName: "One",   admissionNumber: "ADM-1" }, s2: { id: "s2", firstName: "Bayo", lastName: "Two",   admissionNumber: "ADM-2" },
    s3: { id: "s3", firstName: "Chi",  lastName: "Three", admissionNumber: "ADM-3" }, s4: { id: "s4", firstName: "Dayo", lastName: "Four",  admissionNumber: "ADM-4" },
    s5: { id: "s5", firstName: "Efe",  lastName: "Five",  admissionNumber: "ADM-5" },
};
const guardianLinks: Record<string, string[]> = { s1: ["g1"], s2: ["g1b"], s3: ["g2"], s4: ["g3"], s5: ["g2b"] };
// s5 started the term in class A, then moved to class B (one enrolment per student and term: it now says B)
const enrolments = [
    { studentId: "s1", classId: "A", termId: TERM_NOW, status: "active" }, { studentId: "s2", classId: "A", termId: TERM_NOW, status: "active" },
    { studentId: "s3", classId: "B", termId: TERM_NOW, status: "active" }, { studentId: "s4", classId: "C", termId: TERM_NOW, status: "active" },
    { studentId: "s5", classId: "B", termId: TERM_NOW, status: "active" },
    { studentId: "s4", classId: "C", termId: TERM_OLD, status: "completed" },
];
let n = 0;
const mark = (studentId: string, classId: string, termId: string, status: string, date: string) => ({ id: `m${++n}`, studentId, classId, termId, status, date: new Date(date) });
const marks = [
    mark("s1", "A", TERM_NOW, "present", "2026-02-02"), mark("s1", "A", TERM_NOW, "absent", "2026-02-03"), mark("s2", "A", TERM_NOW, "present", "2026-02-02"), mark("s2", "A", TERM_NOW, "present", "2026-02-03"),
    mark("s3", "B", TERM_NOW, "present", "2026-02-02"), mark("s3", "B", TERM_NOW, "late", "2026-02-03"),
    mark("s4", "C", TERM_NOW, "absent", "2026-02-02"), mark("s4", "C", TERM_NOW, "absent", "2026-02-03"), mark("s4", "C", TERM_OLD, "present", "2025-02-03"),
    mark("s5", "A", TERM_NOW, "present", "2026-02-02"), mark("s5", "B", TERM_NOW, "absent", "2026-02-03"),   // one day in A before the move, one in B after
];

/* ── mini evaluator for the filters the scope code produces ── */
const termOf = (id: string) => terms.find(t => t.id === id)!;
const enrolRow = (e: any) => ({ ...e, class: classes[e.classId], term: termOf(e.termId), student: { id: e.studentId, guardianLinks: (guardianLinks[e.studentId] ?? []).map(g => ({ guardianId: g })) } });
const markRow = (m: any) => ({ ...m, class: classes[m.classId] ?? null, term: termOf(m.termId), student: { id: m.studentId, guardianLinks: (guardianLinks[m.studentId] ?? []).map(g => ({ guardianId: g })) } });
function matches(row: any, where: any): boolean {
    if (!where || typeof where !== "object") return true;
    return Object.entries(where).every(([k, v]: [string, any]) => {
        if (k === "AND") return (v as any[]).every(w => matches(row, w));
        if (k === "OR")  return (v as any[]).some(w => matches(row, w));
        const cell = row?.[k];
        if (v && typeof v === "object" && !(v instanceof Date)) {
            if ("in" in v)   return Array.isArray(v.in) && v.in.includes(cell);
            if ("some" in v) return Array.isArray(cell) && cell.some((c: any) => matches(c, v.some));
            return cell != null && matches(cell, v);
        }
        return cell === v;
    });
}

function school() {
    const repo: any = {
        allTerms: async () => terms,
        findStudent: async (id: string) => students[id] ?? null,
        findClass: async (id: string) => classes[id] ?? null,
        enrolledWithin: async (where: any, studentId: string, termId: string) => enrolments.some(e => e.studentId === studentId && e.termId === termId && matches(enrolRow(e), where)),
        guardianLinked: async (g: string, s: string) => (guardianLinks[s] ?? []).includes(g.replace(/^g/, "g")) && (guardianLinks[s] ?? []).includes(g),
        statusCounts: async (where: any) => { const m = new Map<string, number>(); for (const r of marks.filter(x => matches(markRow(x), where))) m.set(r.status, (m.get(r.status) ?? 0) + 1); return [...m].map(([status, count]) => ({ status, count })); },
        studentClassIn: async (studentId: string, termId: string) => { const e = enrolments.find(x => x.studentId === studentId && x.termId === termId && ["active", "completed"].includes(x.status)); return e ? { classId: e.classId, class: { id: e.classId, name: classes[e.classId].name } } : null; },
        registerDays: async (classId: string, termId: string) => new Set(marks.filter(m => m.classId === classId && m.termId === termId).map(m => m.date.toISOString())).size,
        studentsOnRegister: async (classId: string, termId: string) => enrolments.filter(e => e.classId === classId && e.termId === termId && ["active", "completed"].includes(e.status)).map(e => ({ studentId: e.studentId, student: students[e.studentId] })),
        statusCountsByStudent: async (classId: string, termId: string) => { const m = new Map<string, number>(); for (const r of marks.filter(x => x.classId === classId && x.termId === termId)) m.set(`${r.studentId}|${r.status}`, (m.get(`${r.studentId}|${r.status}`) ?? 0) + 1); return [...m].map(([k, count]) => { const [studentId, status] = k.split("|"); return { studentId, status, count }; }); },
        staffCoversClass: async (staffId: string, classId: string, termId: string) => classes[classId].classTeacherId === staffId || classes[classId].classSubjects.some((c: any) => c.staffId === staffId && c.termId === termId),
        classInBranches: async (classId: string, branches: string[]) => branches.includes(classes[classId].branchId),
    };
    return { repo, student: new StudentSummaryUseCase({ attendanceRepository: repo }), klass: new ClassSummaryUseCase({ attendanceRepository: repo }) };
}
const people = {
    s1: acc("STUDENT", "s1", { "attendance.view": "OWN" }), g1: acc("GUARDIAN", "g1", { "attendance.view": "OWN" }),
    t1: acc("STAFF", "T1", { "attendance.view": "ASSIGNED" }),            // class teacher of A
    t3: acc("STAFF", "T3", { "attendance.view": "ASSIGNED" }),            // subject teacher in B (this term) and C (last term only)
    t9: acc("STAFF", "T9", { "attendance.view": "ASSIGNED" }),            // a teacher with no classes
    b1: acc("STAFF", "BR", { "attendance.view": "BRANCH" }, ["b1"]),      // branch staff, branch b1 (classes A and C)
    all: acc("STAFF", "AD", { "attendance.view": "ALL" }),
    none: acc("STAFF", "NO", {}),
};
const gone = { statusCode: 404 };
const stu = (w: ReturnType<typeof school>, who: Access, studentId: string, termId?: string) => w.student.execute({ studentId, termId } as any, who);

describe("student summary: who may open whose", () => {
    it("a student: their own summary yes; anyone else's is a plain 404", async () => {
        const w = school(); const r = await stu(w, people.s1, "s1");
        assert.equal(r.student.id, "s1"); assert.equal(r.daysMarked, 2);
        for (const other of ["s2", "s3", "s4"]) await assert.rejects(stu(w, people.s1, other), gone);
    });
    it("a guardian: a linked child yes; unlinked children are a plain 404", async () => {
        const w = school(); assert.equal((await stu(w, people.g1, "s1")).student.id, "s1");
        for (const other of ["s2", "s3", "s4"]) await assert.rejects(stu(w, people.g1, other), gone);
    });
    it("the class teacher of A: A's students yes; B and C no (leading a class is the only thing that opens it)", async () => {
        const w = school(); for (const ok of ["s1", "s2"]) assert.equal((await stu(w, people.t1, ok)).student.id, ok);
        for (const no of ["s3", "s4", "s5"]) await assert.rejects(stu(w, people.t1, no), gone);
    });
    it("a subject teacher: the classes they teach THIS term yes (B), not the ones they taught last term (C) nor unrelated ones (A)", async () => {
        const w = school(); assert.equal((await stu(w, people.t3, "s3")).student.id, "s3");
        for (const no of ["s1", "s2", "s4"]) await assert.rejects(stu(w, people.t3, no), gone);
    });
    it("a teacher with no classes, and a person with no permission, see nobody", async () => {
        const w = school(); for (const s of ["s1", "s3", "s4"]) { await assert.rejects(stu(w, people.t9, s), gone); await assert.rejects(stu(w, people.none, s), gone); }
    });
    it("branch staff: classes of their branch (A, C) yes, the other branch (B) no", async () => {
        const w = school(); for (const ok of ["s1", "s4"]) assert.equal((await stu(w, people.b1, ok)).student.id, ok); await assert.rejects(stu(w, people.b1, "s3"), gone);
    });
    it("ALL sees everyone", async () => { const w = school(); for (const s of ["s1", "s3", "s4"]) assert.equal((await stu(w, people.all, s)).student.id, s); });
});

describe("student summary: nothing about an out-of-scope student comes back", () => {
    it("an out-of-scope request answers exactly like a student who does not exist (no name, number, class or counts)", async () => {
        const w = school();
        const real = await stu(w, people.g1, "s3").then(() => null, (e: any) => e); const fake = await stu(w, people.g1, "no-such-student").then(() => null, (e: any) => e);
        assert.deepEqual([real.statusCode, real.code, real.message], [fake.statusCode, fake.code, fake.message]);
        for (const bad of [real, fake]) { const text = JSON.stringify(bad); for (const leak of ["Chi", "Three", "ADM-3", "JSS 2B"]) assert.ok(!text.includes(leak), leak); }
    });
    it("a bad term cannot tell a real student from a missing one (the term is checked first, for everybody)", async () => {
        const w = school();
        const real = await stu(w, people.g1, "s3", "no-such-term").then(() => null, (e: any) => e); const fake = await stu(w, people.g1, "no-such-student", "no-such-term").then(() => null, (e: any) => e);
        assert.equal(real.code, "ATTENDANCE_OUTSIDE_TERM"); assert.equal(fake.code, "ATTENDANCE_OUTSIDE_TERM");
    });
    it("a student who moved class: the old class's teacher sees nothing of them, the new class's teacher sees only the days marked in THEIR class", async () => {
        const w = school();
        await assert.rejects(stu(w, people.t1, "s5"), gone);                                       // s5 is in B now: T1 (A) has no way in
        const r = await stu(w, acc("STAFF", "T2", { "attendance.view": "ASSIGNED" }), "s5");        // T2 leads B
        assert.equal(r.daysMarked, 1, "the day marked in class A is not counted for B's teacher"); assert.equal(r.absent, 1); assert.equal(r.present, 0);
        assert.equal(r.class!.id, "B");
    });
    it("a guardian's response contains only their child (identifiers, class and counts)", async () => {
        const w = school(); const r = await stu(w, people.g1, "s1"); const text = JSON.stringify(r);
        for (const leak of ["s2", "s3", "Bayo", "ADM-2", "JSS 2B", "SS 1C"]) assert.ok(!text.includes(leak), leak);
        assert.equal(r.class!.id, "A");
    });
    it("every number is computed from visible rows only: a subject teacher sees no other class's marks for the same student", async () => {
        const w = school(); const r = await stu(w, acc("STAFF", "T3", { "attendance.view": "ASSIGNED" }), "s5");
        assert.equal(r.daysMarked, 1);                                                             // s5's day in A (taught by T1) is invisible
    });
});

describe("class summary: who may open which class, and what is in it", () => {
    const cls = (w: ReturnType<typeof school>, who: Access, id: string, termId?: string) => w.klass.execute(id, { termId } as any, who);
    it("the class teacher opens their class and sees its students; another class is forbidden", async () => {
        const w = school(); const r = await cls(w, people.t1, "A");
        assert.deepEqual(r.students.map((x: any) => x.student.id).sort(), ["s1", "s2"]);
        await assert.rejects(cls(w, people.t1, "B"), { statusCode: 403 }); await assert.rejects(cls(w, people.t1, "C"), { statusCode: 403 });
    });
    it("a subject teacher opens the class they teach this term (B) but not an unrelated one (A)", async () => {
        const w = school(); assert.equal((await cls(w, people.t3, "B")).class.id, "B"); await assert.rejects(cls(w, people.t3, "A"), { statusCode: 403 });
    });
    it("students, guardians and people with no permission cannot open any class summary", async () => {
        const w = school(); for (const who of [people.s1, people.g1, people.none, people.t9]) await assert.rejects(cls(w, who, "A"), { statusCode: 403 });
    });
    it("branch staff: their branch's classes only", async () => {
        const w = school(); assert.equal((await cls(w, people.b1, "C")).class.id, "C"); await assert.rejects(cls(w, people.b1, "B"), { statusCode: 403 });
    });
    it("the class totals and the per-student rows are made of that class's marks only (no other class, no other student)", async () => {
        const w = school(); const r = await cls(w, people.t1, "A");
        assert.equal(r.classSummary.daysMarked, 4);                                                 // s1:2 + s2:2; s5 moved to B, so even their day marked in A is not in A's summary
        const text = JSON.stringify(r); for (const leak of ["Chi", "ADM-3", "Dayo", "ADM-4", "SS 1C"]) assert.ok(!text.includes(leak), leak);
        assert.equal(r.students.find((x: any) => x.student.id === "s1").daysMarked, 2);
    });
});

describe("the school dashboard's attendance block follows the same scope", () => {
    function dashboard() {
        const w = school(); const day = new Date().toISOString().slice(0, 10);
        const todayMarks = [mark("s1", "A", TERM_NOW, "present", day), mark("s2", "A", TERM_NOW, "absent", day), mark("s3", "B", TERM_NOW, "present", day), mark("s4", "C", TERM_NOW, "late", day), mark("s4", "C", TERM_NOW, "excused", day + "T00:00:00.000Z")];
        const tenant: any = {
            currentTermWithSession: async () => null,
            attendanceCountsBetween: async (_s: Date, _e: Date, scope: Record<string, unknown> = {}) => { const o: Record<string, number> = {}; for (const m of todayMarks.filter(x => matches(markRow(x), scope))) o[m.status] = (o[m.status] ?? 0) + 1; return o; },
        };
        const uc = new GetDashboardUseCase({
            prismaClient: { schoolEntitlementOverride: { findUnique: async () => null }, planEntitlement: { findUnique: async () => null } } as any,
            schoolRepository: { findById: async () => ({ name: "S", timezone: "Africa/Lagos", verificationStatus: "verified" }) } as any,
            schoolTenantRepository: tenant, subscriptionRepository: { findActiveBySchoolId: async () => null } as any, planRepository: { findById: async () => null } as any,
        });
        const run = (who: Access) => uc.execute("sch", k => who.can(k), { scope: String(who.scopeOf("attendance.view")), where: attendanceViewWhere(who) });
        return { run, w };
    }
    it("a class teacher with dashboard access sees only their class's counts, not the whole school's", async () => {
        const { run } = dashboard(); const r = await run(people.t1);
        assert.deepEqual([r.attendance!.scope, r.attendance!.present, r.attendance!.absent, r.attendance!.late, r.attendance!.excused], ["ASSIGNED", 1, 1, 0, 0]);
    });
    it("branch staff see their branch (A and C), a teacher with no classes sees zeros, ALL sees the school", async () => {
        const { run } = dashboard();
        const b = (await run(people.b1)).attendance!; assert.deepEqual([b.present, b.absent, b.late, b.excused], [1, 1, 1, 1]);
        const none = (await run(people.t9)).attendance!; assert.deepEqual([none.present, none.absent, none.late, none.excused], [0, 0, 0, 0]);
        const all = (await run(people.all)).attendance!; assert.deepEqual([all.present, all.absent, all.late, all.excused], [2, 1, 1, 1]);
    });
    it("without attendance.view there is no attendance block, and without a scope from the caller there are no counts at all", async () => {
        const { run } = dashboard(); assert.equal((await run(people.none)).attendance, null);
        const uc: any = new GetDashboardUseCase({ prismaClient: { schoolEntitlementOverride: { findUnique: async () => null } } as any, schoolRepository: { findById: async () => ({ name: "S", timezone: "Africa/Lagos", verificationStatus: "v" }) } as any, schoolTenantRepository: { currentTermWithSession: async () => null } as any, subscriptionRepository: { findActiveBySchoolId: async () => null } as any, planRepository: {} as any });
        assert.equal((await uc.execute("sch", k => k === "attendance.view")).attendance, null);
    });
});
