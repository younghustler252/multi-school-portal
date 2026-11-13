/*
| BRANCH SCOPE, end to end, on a real database (attendance, enrolment, grades).
| Two branches, one class in each, students and marks in each. A person scoped to a branch must see that branch and
| nothing else: lists, single records, summaries, and filters that try to reach across ("widening").
| (A class belongs to one branch, so the class's branchId decides.)
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { Access } from "../../src/foundation/access.service";
import { seed, buildDeps, day, adminAccess } from "../attendance/fixtures";
import { enrolmentScopeWhere } from "../../src/modules/enrolment/services/enrolment-scope";
import { ListAttendanceUseCase } from "../../src/modules/attendance/usecases/list-attendance.usecase";
import { GetRegisterUseCase } from "../../src/modules/attendance/usecases/get-register.usecase";
import { ClassSummaryUseCase, StudentSummaryUseCase } from "../../src/modules/attendance/usecases/attendance-summaries.usecases";
import { SubmitRegisterUseCase } from "../../src/modules/attendance/usecases/submit-register.usecase";
import { GradesSheetsRepository } from "../../src/modules/grades/repositories/grades-sheets.repository";
import { ListSheetsUseCase, GetSheetUseCase, ListGradesUseCase } from "../../src/modules/grades/usecases/grades-sheets-read.usecases";
import { SaveScoresUseCase } from "../../src/modules/grades/usecases/save-scores.usecase";

type Perms = Record<string, string>;
const who = (persona: "STAFF" | "STUDENT" | "GUARDIAN", id: string | null, perms: Perms, branches: string[] = []) =>
    new Access("school", "user-" + (id ?? "x"), "m1", persona, id, new Set(), false, new Map(Object.entries(perms)) as any, new Set(branches));

const VIEW_BRANCH: Perms = { "attendance.view": "BRANCH", "enrolment.view": "BRANCH", "grades.view": "BRANCH" };
const statusCode = (e: any) => e?.statusCode;

describe("BRANCH scope (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    let S: any;   // seed + the second branch
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const att = () => {
        const deps = buildDeps();
        return {
            list: new ListAttendanceUseCase(deps as any), reg: new GetRegisterUseCase(deps as any),
            klass: new ClassSummaryUseCase(deps as any), student: new StudentSummaryUseCase(deps as any), submit: new SubmitRegisterUseCase(deps as any),
        };
    };
    const gdeps = () => ({ gradesSheetsRepository: new GradesSheetsRepository(), auditService: { log: async () => {} } } as any);
    const sheets   = (a: Access, q: any = {}) => new ListSheetsUseCase(gdeps()).execute({ page: 1, limit: 100, ...q }, a);
    const sheet    = (id: string, a: Access) => new GetSheetUseCase(gdeps()).execute(id, a);
    const results  = (a: Access, q: any = {}) => new ListGradesUseCase(gdeps()).execute({ page: 1, limit: 100, ...q }, a);

    const mainPerson  = () => who("STAFF", "p-main",  VIEW_BRANCH, [S.mainId]);
    const northPerson = () => who("STAFF", "p-north", VIEW_BRANCH, [S.northId]);
    const bothPerson  = () => who("STAFF", "p-both",  VIEW_BRANCH, [S.mainId, S.northId]);
    const noBranch    = () => who("STAFF", "p-none",  VIEW_BRANCH, []);
    const everyone    = () => who("STAFF", "p-all",   { "attendance.view": "ALL", "enrolment.view": "ALL", "grades.view": "ALL" });

    before(async () => {
        school = await createTestSchool();
        S = await school.run(async () => {
            const base = await seed();                                   // Main branch: classes C1, C2, students s1..s6
            const d = db();
            const mainId = base.C1.branchId ?? (await d.class.findUnique({ where: { id: base.C1.id } })).branchId;
            const north = await d.branch.create({ data: { name: "North", code: "NORTH" } });
            const C3 = await d.class.create({ data: { name: "JSS 3N", branchId: north.id, level: "JSS", classTeacherId: base.tA.id } });
            const sN1 = await d.student.create({ data: { firstName: "Nnamdi", lastName: "North", branchId: north.id } });
            const sN2 = await d.student.create({ data: { firstName: "Ngozi", lastName: "North", branchId: north.id } });
            for (const s of [sN1, sN2]) await d.enrolment.create({ data: { studentId: s.id, classId: C3.id, termId: base.term.id, status: "active" } });

            // marks: one in a Main class (s1 in C1), one in the North class (sN1 in C3)
            const mark = (studentId: string, classId: string, off: number) =>
                d.attendance.create({ data: { studentId, classId, termId: base.term.id, date: new Date(`${day(off)}T00:00:00Z`), status: "present" } });
            await mark(base.s1.id, base.C1.id, -2); await mark(base.s2.id, base.C1.id, -2); await mark(sN1.id, C3.id, -2);

            // mark sheets: Maths in C1 (Main), Maths in C3 (North); one student's scores each, entered by the admin
            const maths = await d.subject.create({ data: { name: "Maths-bs" } });
            const csMain  = await d.classSubject.create({ data: { classId: base.C1.id, subjectId: maths.id, staffId: base.tB.id, termId: base.term.id } });
            const csNorth = await d.classSubject.create({ data: { classId: C3.id,      subjectId: maths.id, staffId: base.tB.id, termId: base.term.id } });
            const admin = who("STAFF", "admin-staff", { "grades.view": "ALL", "grades.enter": "ALL" }, []);
            const put = (cs: any, studentId: string) => new SaveScoresUseCase(gdeps()).execute(school.schoolId, cs.id,
                { entries: [{ studentId, scores: [{ position: 1, score: 30 }, { position: 2, score: 50 }] }] } as any, admin, { userId: "user-admin" });
            await put(csMain, base.s1.id); await put(csNorth, sN1.id);
            return { ...base, mainId, northId: north.id, C3, sN1, sN2, csMain, csNorth };
        });
    });
    after(async () => { await school.drop(); });

    /* ───────────────────────────── attendance ───────────────────────────── */
    describe("attendance", () => {
        it("LIST: each branch sees only its own marks; two branches see both; no branch sees none; ALL sees all", () => school.run(async () => {
            const { list } = att();
            const ids = async (a: Access) => (await list.execute({ page: 1, limit: 100 } as any, a)).data.map((r: any) => r.student.id).sort();
            assert.deepEqual(await ids(mainPerson()),  [S.s1.id, S.s2.id].sort());
            assert.deepEqual(await ids(northPerson()), [S.sN1.id]);
            assert.deepEqual(await ids(bothPerson()),  [S.s1.id, S.s2.id, S.sN1.id].sort());
            assert.deepEqual(await ids(noBranch()),    []);
            assert.deepEqual(await ids(everyone()),    [S.s1.id, S.s2.id, S.sN1.id].sort());
        }));

        it("LIST: filters can narrow but never reach across a branch (classId / studentId of the other branch gives nothing)", () => school.run(async () => {
            const { list } = att();
            const r1 = await list.execute({ page: 1, limit: 100, classId: S.C3.id } as any, mainPerson());
            const r2 = await list.execute({ page: 1, limit: 100, studentId: S.sN1.id } as any, mainPerson());
            const r3 = await list.execute({ page: 1, limit: 100, classId: S.C3.id } as any, northPerson());
            assert.equal(r1.data.length, 0); assert.equal(r1.meta.total, 0);
            assert.equal(r2.data.length, 0);
            assert.equal(r3.data.length, 1, "their own branch's class is still reachable");
        }));

        it("REGISTER: opens a class of their branch, is refused another branch's class, and can never mark with a view-only BRANCH grant", () => school.run(async () => {
            const { reg } = att();
            const ok = await reg.execute(S.C1.id, day(-2), mainPerson());
            assert.equal(ok.class.name, "JSS 1A"); assert.equal(ok.canMark, false, "BRANCH is view-only");
            await assert.rejects(reg.execute(S.C3.id, day(-2), mainPerson()), (e: any) => statusCode(e) === 403);
            await assert.rejects(reg.execute(S.C1.id, day(-2), northPerson()), (e: any) => statusCode(e) === 403);
            assert.equal((await reg.execute(S.C3.id, day(-2), northPerson())).students.length, 2);
            await assert.rejects(reg.execute(S.C1.id, day(-2), noBranch()), (e: any) => statusCode(e) === 403, "no branches: no class");
        }));

        it("CLASS SUMMARY: same rule as the register", () => school.run(async () => {
            const { klass } = att();
            assert.equal((await klass.execute(S.C3.id, {} as any, northPerson())).students.length, 2);
            await assert.rejects(klass.execute(S.C3.id, {} as any, mainPerson()), (e: any) => statusCode(e) === 403);
            await assert.rejects(klass.execute(S.C1.id, {} as any, noBranch()), (e: any) => statusCode(e) === 403);
        }));

        it("STUDENT SUMMARY: a student of another branch looks like they do not exist; their own branch's student is shown", () => school.run(async () => {
            const { student } = att();
            assert.equal((await student.execute({ studentId: S.sN1.id } as any, northPerson())).daysMarked, 1);
            assert.equal((await student.execute({ studentId: S.s1.id } as any, mainPerson())).daysMarked, 1);
            for (const [a, id] of [[mainPerson(), S.sN1.id], [northPerson(), S.s1.id], [noBranch(), S.s1.id]] as const)
                await assert.rejects(student.execute({ studentId: id } as any, a), (e: any) => statusCode(e) === 404);
            assert.equal((await student.execute({ studentId: S.sN1.id } as any, everyone())).daysMarked, 1);
        }));

        it("BRANCH never lets someone MARK: a branch person cannot take or change a register, even in their own branch", () => school.run(async () => {
            const { submit } = att();
            // mark permission only ever offers ALL / ASSIGNED; if a branch person somehow held it as BRANCH it must still match no class
            const a = who("STAFF", "p-north", { ...VIEW_BRANCH, "attendance.mark": "BRANCH" }, [S.northId]);
            await assert.rejects(submit.execute(school.schoolId, S.C3.id, { date: day(-1), entries: [{ studentId: S.sN1.id, status: "present" }] } as any, a, { userId: "u" } as any),
                (e: any) => statusCode(e) === 403);
            const before = await db().attendance.count({ where: { classId: S.C3.id } });
            assert.equal(before, 1, "nothing was saved");
        }));

        it("MOVING a class to another branch moves who can see it (the class's branch decides, not the students')", () => school.run(async () => {
            const { reg } = att();
            await db().class.update({ where: { id: S.C3.id }, data: { branchId: S.mainId } });
            try {
                assert.equal((await reg.execute(S.C3.id, day(-2), mainPerson())).students.length, 2);
                await assert.rejects(reg.execute(S.C3.id, day(-2), northPerson()), (e: any) => statusCode(e) === 403);
            } finally { await db().class.update({ where: { id: S.C3.id }, data: { branchId: S.northId } }); }
        }));
    });

    /* ───────────────────────────── enrolment ───────────────────────────── */
    describe("enrolment (the real filter, run against real rows)", () => {
        const visible = async (a: Access) =>
            (await db().enrolment.findMany({ where: { AND: [enrolmentScopeWhere(a), { termId: S.term.id }] }, select: { studentId: true } })).map((r: any) => r.studentId).sort();
        it("each branch sees only its class lists; two branches both; none sees nothing; ALL everything", () => school.run(async () => {
            const mainStudents = [S.s1.id, S.s2.id, S.s3.id, S.s4.id, S.s5.id];   // seed: s5 is withdrawn but still on the list
            assert.deepEqual(await visible(mainPerson()),  [...mainStudents].sort());
            assert.deepEqual(await visible(northPerson()), [S.sN1.id, S.sN2.id].sort());
            assert.deepEqual(await visible(bothPerson()),  [...mainStudents, S.sN1.id, S.sN2.id].sort());
            assert.deepEqual(await visible(noBranch()),    []);
            assert.deepEqual(await visible(everyone()),    [...mainStudents, S.sN1.id, S.sN2.id].sort());
        }));
        it("a student or guardian given a BRANCH grant by mistake sees nothing (BRANCH is for staff only)", () => school.run(async () => {
            assert.deepEqual(await visible(who("STUDENT", S.s1.id, { "enrolment.view": "BRANCH" }, [S.mainId])), []);
            assert.deepEqual(await visible(who("GUARDIAN", S.guardian.id, { "enrolment.view": "BRANCH" }, [S.mainId])), []);
        }));
    });

    /* ───────────────────────────── grades ───────────────────────────── */
    describe("grades", () => {
        it("SHEETS LIST: only the sheets of classes in the person's branches", () => school.run(async () => {
            const ids = async (a: Access) => (await sheets(a)).data.map((r: any) => r.classSubjectId).filter((id: string) => [S.csMain.id, S.csNorth.id].includes(id)).sort();
            assert.deepEqual(await ids(mainPerson()),  [S.csMain.id]);
            assert.deepEqual(await ids(northPerson()), [S.csNorth.id]);
            assert.deepEqual(await ids(bothPerson()),  [S.csMain.id, S.csNorth.id].sort());
            assert.deepEqual(await ids(noBranch()),    []);
            assert.deepEqual(await ids(everyone()),    [S.csMain.id, S.csNorth.id].sort());
        }));
        it("ONE SHEET: opens in the person's branch, refused in another, refused with no branches", () => school.run(async () => {
            assert.equal((await sheet(S.csNorth.id, northPerson())).class.name, "JSS 3N");
            assert.equal((await sheet(S.csMain.id, mainPerson())).class.name, "JSS 1A");
            for (const [a, id] of [[mainPerson(), S.csNorth.id], [northPerson(), S.csMain.id], [noBranch(), S.csMain.id]] as const)
                await assert.rejects(sheet(id, a), (e: any) => statusCode(e) === 403);
        }));
        it("ONE SHEET: a branch viewer can look but not change (can.enter / can.submit are false)", () => school.run(async () => {
            const s = await sheet(S.csNorth.id, northPerson());
            assert.equal(s.can.enter, false); assert.equal(s.can.submit, false);
        }));
        it("RESULTS: only results of classes in the person's branches; filters cannot reach across", () => school.run(async () => {
            const students = async (a: Access, q: any = {}) => (await results(a, q)).data.map((r: any) => r.student.id).sort();
            assert.deepEqual(await students(mainPerson()),  [S.s1.id]);
            assert.deepEqual(await students(northPerson()), [S.sN1.id]);
            assert.deepEqual(await students(bothPerson()),  [S.s1.id, S.sN1.id].sort());
            assert.deepEqual(await students(noBranch()),    []);
            assert.deepEqual(await students(mainPerson(),  { studentId: S.sN1.id }), []);
            assert.deepEqual(await students(mainPerson(),  { classId: S.C3.id }), []);
            assert.deepEqual(await students(northPerson(), { classId: S.C3.id }), [S.sN1.id]);
        }));
        it("a BRANCH person cannot enter scores (grades.enter never offers BRANCH, and view does not grant it)", () => school.run(async () => {
            await assert.rejects(new SaveScoresUseCase(gdeps()).execute(school.schoolId, S.csNorth.id,
                { entries: [{ studentId: S.sN1.id, scores: [{ position: 1, score: 10 }] }] } as any, northPerson(), { userId: "u" }), () => true);
        }));
    });
});
