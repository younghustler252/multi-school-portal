/*
| MARK SHEETS against a real database (a throwaway school with every tenant migration applied).
| Runs only when TEST_DATABASE_URL is set (the database name must contain "test"). Tests share one seeded school and run in order.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { Access } from "../../src/foundation/access.service";
import { GradesSheetsRepository } from "../../src/modules/grades/repositories/grades-sheets.repository";
import { GradeRepositoryImpl } from "../../src/modules/grades/repositories/grade.repository.impl";
import { ListSheetsUseCase, GetSheetUseCase, ListGradesUseCase } from "../../src/modules/grades/usecases/grades-sheets-read.usecases";
import { SaveScoresUseCase } from "../../src/modules/grades/usecases/save-scores.usecase";
import { SheetTransitionUseCase } from "../../src/modules/grades/usecases/sheet-transition.usecase";
import { SaveScaleUseCase, SaveSchemeUseCase } from "../../src/modules/grades/usecases/grades-setup.usecases";
import { GradesSetupRepository } from "../../src/modules/grades/repositories/grades-setup.repository";
import { ReopenDto } from "../../src/modules/grades/dtos/grades-sheets.dto";

const acc = (persona: "STAFF" | "STUDENT" | "GUARDIAN", id: string | null, perms: Record<string, string>, userId = "user-" + (id ?? "x").slice(0, 6)) =>
    new Access("school", userId, "m1", persona, id, new Set(), false, new Map(Object.entries(perms)) as any);

describe("mark sheets (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; const audits: any[] = [];
    let S: any;
    const deps = () => ({ gradesSheetsRepository: new GradesSheetsRepository(), auditService: { log: async (p: any) => { audits.push(p); } } } as any);
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const get = (id: string, a: Access) => new GetSheetUseCase(deps()).execute(id, a);
    const save = (id: string, entries: any[], a: Access) => new SaveScoresUseCase(deps()).execute(school.schoolId, id, { entries } as any, a, { userId: "user-t" });
    const move = (action: any, id: string, a: Access, reason?: string) => new SheetTransitionUseCase(deps()).execute(action, school.schoolId, id, { reason }, a, { userId: "user-mv" });
    const list = (q: any, a: Access) => new ListGradesUseCase(deps()).execute({ page: 1, limit: 100, ...q }, a);
    const e = (studentId: string, ca?: number | null, ex?: number | null, absentEx = false) => ({ studentId, scores: [
        ...(ca !== undefined ? [{ position: 1, score: ca }] : []), ...(ex !== undefined ? [{ position: 2, score: ex }] : []), ...(absentEx ? [{ position: 2, absent: true }] : []) ] });
    const row = (sheet: any, name: string) => sheet.students.find((r: any) => r.student.name === name);

    const teacherB = () => acc("STAFF", S.tB.id, { "grades.view": "ASSIGNED", "grades.enter": "ASSIGNED", "grades.submit": "ASSIGNED" });   // teaches Maths
    const teacherC = () => acc("STAFF", S.tC.id, { "grades.view": "ASSIGNED", "grades.enter": "ASSIGNED", "grades.submit": "ASSIGNED" });   // teaches English
    const classTeacherA = () => acc("STAFF", S.tA.id, { "grades.view": "ASSIGNED", "grades.enter": "ASSIGNED", "grades.submit": "ASSIGNED" }); // leads JSS 1A, teaches neither
    const principal = () => acc("STAFF", "principal-staff", { "grades.view": "ALL", "grades.approve": "ALL", "grades.publish": "ALL" }, "user-principal");
    const admin = () => acc("STAFF", "admin-staff", { "grades.view": "ALL", "grades.enter": "ALL", "grades.submit": "ALL", "grades.approve": "ALL", "grades.publish": "ALL", "grades.reopen": "ALL", "grades.config": "ALL" }, "user-admin");
    const guardian = () => acc("GUARDIAN", S.guardian.id, { "grades.view": "OWN" });
    const student = (s: { id: string }) => acc("STUDENT", s.id, { "grades.view": "OWN" });

    before(async () => {
        school = await createTestSchool();
        S = await school.run(async () => {
            const d = db();
            const session = await d.session.create({ data: { name: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true } });
            const term = await d.term.create({ data: { sessionId: session.id, name: "first", startDate: new Date("2026-09-01"), endDate: new Date("2026-12-15"), isCurrent: true } });
            const staff = (n: string) => d.staff.create({ data: { firstName: n, lastName: "Teacher" } });
            const tA = await staff("Tola"), tB = await staff("Bisi"), tC = await staff("Chuka");
            const C1 = await d.class.create({ data: { name: "JSS 1A", level: "JSS", classTeacherId: tA.id } });
            const C2 = await d.class.create({ data: { name: "JSS 1B", level: "JSS" } });
            const maths = await d.subject.create({ data: { name: "Maths" } }), eng = await d.subject.create({ data: { name: "English" } }), sci = await d.subject.create({ data: { name: "Science" } });
            const csMaths = await d.classSubject.create({ data: { classId: C1.id, subjectId: maths.id, staffId: tB.id, termId: term.id } });
            const csEng = await d.classSubject.create({ data: { classId: C1.id, subjectId: eng.id, staffId: tC.id, termId: term.id } });
            const csSci = await d.classSubject.create({ data: { classId: C2.id, subjectId: sci.id, staffId: tC.id, termId: term.id } });
            const stu = (n: string) => d.student.create({ data: { firstName: n, lastName: "Pupil" } });
            const s1 = await stu("Ada"), s2 = await stu("Bola"), s3 = await stu("Chidi"), s4 = await stu("Dayo"), s5 = await stu("Efe"), s6 = await stu("Femi");
            const enrol = (s: any, c: any, st: any = "active") => d.enrolment.create({ data: { studentId: s.id, classId: c.id, termId: term.id, status: st } });
            await enrol(s1, C1); await enrol(s2, C1); await enrol(s3, C1); await enrol(s6, C1); await enrol(s4, C1, "withdrawn");   // Efe (s5) is on no list
            const guardian = await d.guardian.create({ data: { firstName: "Gina", lastName: "Parent", email: "gina@x.com" } });
            await d.studentGuardian.create({ data: { guardianId: guardian.id, studentId: s1.id, relation: "mother", isPrimary: false } });
            return { term, tA, tB, tC, C1, C2, csMaths, csEng, csSci, s1, s2, s3, s4, s5, s6, guardian };
        });
    });
    after(async () => { await school.drop(); });

    describe("opening a sheet", () => {
        it("a new sheet is a draft with the default parts (CA 40 + Exam 60) and everyone on the class list, withdrawn students left off", () => school.run(async () => {
            const sh = await get(S.csMaths.id, teacherB());
            assert.equal(sh.status, "draft"); assert.equal(sh.id, null);
            assert.deepEqual(sh.parts.map(p => [p.name, p.kind, p.maxScore]), [["CA", "ca", 40], ["Exam", "exam", 60]]);
            assert.deepEqual(sh.students.map(r => r.student.name), ["Ada Pupil", "Bola Pupil", "Chidi Pupil", "Femi Pupil"]);
            assert.equal(sh.class.name, "JSS 1A"); assert.equal(sh.subject.name, "Maths"); assert.equal(sh.teacher.name, "Bisi Teacher");
            assert.deepEqual([sh.can.enter, sh.can.submit, sh.can.approve, sh.can.publish, sh.can.reopen], [true, true, false, false, false]);
        }));
        it("who may look: the subject teacher and the class teacher; another subject's teacher, a student and a guardian may not", () => school.run(async () => {
            assert.equal((await get(S.csMaths.id, classTeacherA())).can.enter, false, "the class teacher may look, not enter");
            await assert.rejects(() => get(S.csMaths.id, teacherC()), (e: any) => e.statusCode === 403);
            await assert.rejects(() => get(S.csMaths.id, student(S.s1)), (e: any) => e.statusCode === 403);
            await assert.rejects(() => get(S.csMaths.id, guardian()), (e: any) => e.statusCode === 403);
            assert.equal((await get(S.csMaths.id, admin())).can.enter, true);
        }));
    });

    describe("entering scores", () => {
        it("only the teacher of THAT subject may enter (not the class teacher, not another subject's teacher)", () => school.run(async () => {
            for (const who of [classTeacherA(), teacherC(), student(S.s1)]) await assert.rejects(() => save(S.csMaths.id, [e(S.s1.id, 30, 50)], who), (x: any) => x.statusCode === 403);
            assert.equal(await db().grade.count(), 0);
        }));
        it("saves scores, computes total, grade and remark from the scale, and ranks the class; an incomplete student has NO total and NO rank", () => school.run(async () => {
            const r = await save(S.csMaths.id, [e(S.s1.id, 30, 50), e(S.s2.id, 20, 40), e(S.s3.id, 35)], teacherB());   // Chidi has no exam yet
            assert.deepEqual([r.saved, r.unchanged, r.skipped.length], [3, 0, 0]); assert.equal(r.summary.complete, 2);
            const sh = await get(S.csMaths.id, teacherB());
            assert.deepEqual([row(sh, "Ada Pupil").total, row(sh, "Ada Pupil").grade, row(sh, "Ada Pupil").position], [80, "A1", 1]);
            assert.deepEqual([row(sh, "Bola Pupil").total, row(sh, "Bola Pupil").grade, row(sh, "Bola Pupil").position], [60, "C4", 2]);
            const c = row(sh, "Chidi Pupil");
            assert.deepEqual([c.total, c.grade, c.position], [null, null, null]);
            assert.deepEqual(c.scores, [{ position: 1, score: 35, absent: false }, { position: 2, score: null, absent: false }], "a missing exam is 'not entered', not 0");
            assert.equal(row(sh, "Femi Pupil").scores[0].score, null);
            const g = await db().grade.findFirst({ where: { studentId: S.s1.id } });
            assert.deepEqual([g.caScore, g.examScore, g.isPublished, g.totalStudents], [30, 50, false, 2]);
        }));
        it("a bad entry is skipped WITH its reason and the rest are saved; students not on the list and repeats are skipped too", () => school.run(async () => {
            const r = await save(S.csMaths.id, [e(S.s6.id, 20, 40), { studentId: S.s3.id, scores: [{ position: 2, score: 70 }] }, e(S.s5.id, 10, 10), e(S.s6.id, 1, 1)], teacherB());
            assert.equal(r.saved, 1);
            assert.deepEqual(r.skipped.map(s => [s.reason, s.student?.name ?? null]).sort(), [["duplicate_entry", "Femi Pupil"], ["invalid_score", "Chidi Pupil"], ["not_on_class_list", null]].sort());
            assert.match(r.skipped.find(s => s.reason === "invalid_score")!.message!, /cannot be more than 60/);
            assert.equal((await get(S.csMaths.id, teacherB())).students.find(x => x.student.name === "Chidi Pupil")!.scores[1].score, null, "the bad score was not saved");
            assert.equal(await db().grade.count({ where: { studentId: S.s5.id } }), 0);
        }));
        it("absent counts 0 in the total and shows as ABS; ties share a position (60, 60 are both 2nd, the next is 4th)", () => school.run(async () => {
            await save(S.csMaths.id, [e(S.s3.id, undefined, undefined, true)], teacherB());     // Chidi absent for the exam: 35 + 0 = 35
            const sh = await get(S.csMaths.id, teacherB());
            const c = row(sh, "Chidi Pupil");
            assert.deepEqual([c.total, c.grade, c.position], [35, "F9", 4]);
            assert.deepEqual(c.scores[1], { position: 2, score: null, absent: true });
            assert.deepEqual(sh.students.map(r => [r.student.name, r.position]), [["Ada Pupil", 1], ["Bola Pupil", 2], ["Chidi Pupil", 4], ["Femi Pupil", 2]]);
            assert.equal((await db().grade.findFirst({ where: { studentId: S.s1.id } })).totalStudents, 4);
        }));
        it("saving the same thing again changes nothing; every change is audited old to new with names", () => school.run(async () => {
            const r = await save(S.csMaths.id, [e(S.s1.id, 30, 50)], teacherB());
            assert.deepEqual([r.saved, r.unchanged], [0, 1]);
            await save(S.csMaths.id, [e(S.s2.id, 20, 45)], teacherB());
            const a = audits.filter(x => x.action === "grades.scores_saved").pop();
            assert.deepEqual(a.newValue.changes, [{ student: "Bola Pupil", part: "Exam", from: "40", to: "45" }]);
            assert.deepEqual([a.newValue.class, a.newValue.subject], ["JSS 1A", "Maths"]);
            await save(S.csMaths.id, [e(S.s2.id, 20, 40)], teacherB());    // put Bola back to 60 for the next tests
        }));
        it("the database refuses a score that is both absent and a number, and a grade without a sheet", () => school.run(async () => {
            const g = await db().grade.findFirst({ where: { studentId: S.s1.id } });
            await assert.rejects(() => db().gradeScore.create({ data: { gradeId: g.id, position: 5, score: 3, isAbsent: true } }), /check|constraint/i);
            await assert.rejects(() => db().grade.create({ data: { studentId: S.s5.id, termId: S.term.id, classSubjectId: S.csMaths.id } }), /sheetId|Argument|null/i);
        }));
    });

    describe("submitting needs a complete sheet", () => {
        it("a sheet with nothing entered, or with students still missing, cannot be submitted; the answer says who and which part", () => school.run(async () => {
            await assert.rejects(() => move("submit", S.csEng.id, teacherC()), (x: any) => x.code === "GRADES_SHEET_INCOMPLETE" && x.details.total === 4 && JSON.stringify(x.details.missing[0]).includes('"CA","Exam"'));
            await assert.rejects(() => move("submit", S.csSci.id, teacherC()), (x: any) => x.code === "GRADES_SHEET_EMPTY");
            await assert.rejects(() => move("publish", S.csEng.id, principal()), (x: any) => x.statusCode === 404, "no sheet yet: nothing to publish");
            await save(S.csEng.id, [e(S.s1.id, 30, 40)], teacherC());
            await assert.rejects(() => move("submit", S.csEng.id, teacherC()), (x: any) => x.code === "GRADES_SHEET_INCOMPLETE" && x.details.total === 3);
            await assert.rejects(() => move("submit", S.csEng.id, teacherB()), (x: any) => x.statusCode === 403, "another subject's teacher cannot submit it");
        }));
        it("two people saving the same new sheet at the same moment: no errors, one row per student, valid positions", () => school.run(async () => {
            const call = (n: number) => school.run(() => save(S.csEng.id, [e(S.s1.id, 10 + n, 20 + n), e(S.s2.id, 15 + n, 25 + n), e(S.s3.id, 5 + n, 15 + n), e(S.s6.id, 12 + n, 22 + n)], teacherC()));
            await Promise.all([call(0), call(5)]);
            assert.equal(await db().grade.count({ where: { classSubjectId: S.csEng.id } }), 4);
            assert.equal(await db().gradeScore.count({ where: { grade: { classSubjectId: S.csEng.id } } }), 8);
            assert.equal(await db().resultSheet.count({ where: { classSubjectId: S.csEng.id } }), 1);
            const g = await db().grade.findMany({ where: { classSubjectId: S.csEng.id }, orderBy: { position: "asc" } });
            assert.deepEqual(g.map((x: any) => x.position), [1, 2, 3, 4]);
            const totals = g.map((x: any) => x.total); assert.deepEqual(totals, [...totals].sort((a: number, b: number) => b - a), "positions follow the totals");
        }));
    });

    describe("the workflow, and what students and parents can see at each step", () => {
        it("submit: the sheet is locked against changes", () => school.run(async () => {
            const r = await move("submit", S.csMaths.id, teacherB());
            assert.equal(r.status, "submitted");
            await assert.rejects(() => save(S.csMaths.id, [e(S.s1.id, 31, 50)], teacherB()), (x: any) => x.code === "GRADES_SHEET_NOT_EDITABLE" && x.statusCode === 409);
            await assert.rejects(() => move("submit", S.csMaths.id, teacherB()), (x: any) => x.code === "GRADES_ILLEGAL_TRANSITION");
            assert.equal((await get(S.csMaths.id, teacherB())).can.enter, false);
        }));
        it("approve and publish are for people with those permissions, in order", () => school.run(async () => {
            await assert.rejects(() => move("approve", S.csMaths.id, teacherB()), (x: any) => x.statusCode === 403, "the teacher cannot approve their own sheet");
            await assert.rejects(() => move("publish", S.csMaths.id, principal()), (x: any) => x.code === "GRADES_ILLEGAL_TRANSITION", "approval comes first");
            assert.equal((await move("approve", S.csMaths.id, principal())).status, "approved");
        }));
        it("until it is PUBLISHED, students and guardians see nothing, and report cards read nothing", () => school.run(async () => {
            assert.equal((await list({}, guardian())).meta.total, 0);
            assert.equal((await list({}, student(S.s1))).meta.total, 0);
            assert.deepEqual(await new GradeRepositoryImpl().findByStudentAndTerm(S.s1.id, S.term.id), []);
            assert.ok((await list({ classId: S.C1.id }, principal())).meta.total >= 4, "staff can see drafts in their scope");
        }));
        it("publish: grades go live with the school's scale frozen on the sheet; each family sees only their own", () => school.run(async () => {
            assert.equal((await move("publish", S.csMaths.id, principal())).status, "published");
            const sheet = await db().resultSheet.findUnique({ where: { classSubjectId: S.csMaths.id } });
            assert.equal(sheet.status, "published"); assert.ok(sheet.publishedAt); assert.equal(sheet.scale.length, 9);
            assert.equal((await db().grade.count({ where: { sheetId: sheet.id, isPublished: true } })), 4);
            const mine = await list({}, guardian());
            assert.equal(mine.meta.total, 1);
            assert.deepEqual([mine.data[0].student.name, mine.data[0].subject.name, mine.data[0].class.name, mine.data[0].total, mine.data[0].grade, mine.data[0].position, mine.data[0].outOf], ["Ada Pupil", "Maths", "JSS 1A", 80, "A1", 1, 4]);
            assert.deepEqual(mine.data[0].scores, [{ name: "CA", kind: "ca", maxScore: 40, score: 30, absent: false }, { name: "Exam", kind: "exam", maxScore: 60, score: 50, absent: false }]);
            const own = await list({}, student(S.s2)); assert.deepEqual(own.data.map(r => r.student.name), ["Bola Pupil"]);
            assert.equal((await list({ studentId: S.s1.id }, student(S.s2))).meta.total, 0, "asking for someone else's results finds nothing");
            assert.equal((await new GradeRepositoryImpl().findByStudentAndTerm(S.s1.id, S.term.id)).length, 1);
        }));
        it("a scale changed AFTER publishing does not change published results", () => school.run(async () => {
            const bands = [{ minScore: 90, grade: "A", remark: "Top", isPass: true }, { minScore: 70, grade: "B", remark: "Good", isPass: true }, { minScore: 50, grade: "C", remark: "Fair", isPass: true }, { minScore: 0, grade: "F", remark: "Fail", isPass: false }];
            await new SaveScaleUseCase({ gradesSetupRepository: new GradesSetupRepository(), auditService: { log: async () => undefined } } as any).execute(school.schoolId, "default", { bands } as any, { userId: "user-admin" });
            assert.equal((await db().grade.findFirst({ where: { studentId: S.s1.id, classSubjectId: S.csMaths.id } })).grade, "A1");
            assert.equal((await list({}, guardian())).data[0].grade, "A1");
        }));
        it("lock: still visible to families, still not editable", () => school.run(async () => {
            assert.equal((await move("lock", S.csMaths.id, principal())).status, "locked");
            assert.equal((await list({}, guardian())).meta.total, 1);
            await assert.rejects(() => save(S.csMaths.id, [e(S.s1.id, 31, 50)], teacherB()), (x: any) => x.code === "GRADES_SHEET_NOT_EDITABLE");
        }));
        it("reopening a locked sheet needs the reopen permission and a reason; it is hidden from families at once and audited", () => school.run(async () => {
            await assert.rejects(() => move("reopen", S.csMaths.id, principal(), "Wrong marks entered"), (x: any) => x.statusCode === 403, "the principal cannot reopen a published sheet");
            assert.equal(ReopenDto.safeParse({}).success, false); assert.equal(ReopenDto.safeParse({ reason: "no" }).success, false);
            assert.equal((await move("reopen", S.csMaths.id, admin(), "Wrong marks entered")).status, "draft");
            assert.equal((await list({}, guardian())).meta.total, 0, "hidden immediately");
            assert.deepEqual(await new GradeRepositoryImpl().findByStudentAndTerm(S.s1.id, S.term.id), []);
            const sheet = await db().resultSheet.findUnique({ where: { classSubjectId: S.csMaths.id } });
            assert.deepEqual([sheet.status, sheet.reopenReason, sheet.publishedAt, sheet.scale, sheet.submittedAt], ["draft", "Wrong marks entered", null, null, null]);
            const a = audits.filter(x => x.action === "grades.sheet_reopened").pop();
            assert.deepEqual([a.oldValue.status, a.newValue.reason, a.newValue.subject], ["locked", "Wrong marks entered", "Maths"]);
        }));
        it("after a reopen the teacher can correct it; publishing again applies the school's CURRENT scale and re-ranks", () => school.run(async () => {
            await save(S.csMaths.id, [e(S.s2.id, 20, 50)], teacherB());     // Bola 60 -> 70
            await move("submit", S.csMaths.id, teacherB()); await move("approve", S.csMaths.id, principal()); await move("publish", S.csMaths.id, principal());
            const rows = await list({ classId: S.C1.id, subjectId: (await db().classSubject.findUnique({ where: { id: S.csMaths.id } })).subjectId }, admin());
            const by = Object.fromEntries(rows.data.map(r => [r.student.name, [r.total, r.grade, r.position]]));
            assert.deepEqual(by, { "Ada Pupil": [80, "B", 1], "Bola Pupil": [70, "B", 2], "Femi Pupil": [60, "C", 3], "Chidi Pupil": [35, "F", 4] });
            const a = audits.filter(x => x.action === "grades.sheet_published").pop();
            assert.ok(a.newValue.regraded >= 1); assert.equal(a.newValue.scale[0], "A from 90");
        }));
    });

    describe("lists and the parts of a score", () => {
        it("the list of sheets shows each person only their own: the subject teacher, the class teacher, and everything for the admin", () => school.run(async () => {
            const names = async (a: Access) => (await new ListSheetsUseCase(deps()).execute({ page: 1, limit: 50 } as any, a)).data.map(r => r.subject.name).sort();
            assert.deepEqual(await names(teacherB()), ["Maths"]);
            assert.deepEqual(await names(teacherC()), ["English", "Science"]);
            assert.deepEqual(await names(classTeacherA()), ["English", "Maths"]);
            assert.deepEqual(await names(admin()), ["English", "Maths", "Science"]);
            await assert.rejects(() => Promise.resolve().then(async () => { const r = await new ListSheetsUseCase(deps()).execute({ page: 1, limit: 50 } as any, guardian()); assert.equal(r.data.length, 0); throw new Error("empty"); }), /empty/);
            const all = (await new ListSheetsUseCase(deps()).execute({ page: 1, limit: 50 } as any, admin())).data;
            const m = all.find(r => r.subject.name === "Maths")!; assert.deepEqual([m.status, m.students, m.complete], ["published", 4, 4]);
            const sci = all.find(r => r.subject.name === "Science")!; assert.deepEqual([sci.status, sci.students, sci.complete], ["draft", 0, 0]);
            assert.deepEqual((await new ListSheetsUseCase(deps()).execute({ page: 1, limit: 50, status: "published" } as any, admin())).data.map(r => r.subject.name), ["Maths"]);
        }));
        it("a sheet keeps the parts it started with; a draft with nothing entered follows the school's current scheme", () => school.run(async () => {
            const four = [{ name: "CA1", kind: "ca", maxScore: 10 }, { name: "CA2", kind: "ca", maxScore: 10 }, { name: "Assignment", kind: "ca", maxScore: 20 }, { name: "Exam", kind: "exam", maxScore: 60 }];
            await new SaveSchemeUseCase({ gradesSetupRepository: new GradesSetupRepository(), auditService: { log: async () => undefined } } as any).execute(school.schoolId, "default", { components: four } as any, { userId: "user-admin" });
            assert.equal((await get(S.csMaths.id, admin())).parts.length, 2, "scores exist: the sheet keeps CA + Exam");
            assert.equal((await get(S.csSci.id, admin())).parts.length, 4, "nothing entered yet: follows the new scheme");
        }));
    });
});
