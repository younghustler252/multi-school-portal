/*
| ATTENDANCE against a real database (a throwaway school with every tenant migration applied).
| Runs only when TEST_DATABASE_URL is set (the database name must contain "test"). Tests share one seeded school and run in order.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { access, adminAccess, buildDeps, day, seed } from "./fixtures";

type Seed = Awaited<ReturnType<typeof seed>>;

describe("attendance (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let S: Seed; let deps: ReturnType<typeof buildDeps>;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const uc = async () => ({
        get:    new (await import("../../src/modules/attendance/usecases/get-register.usecase")).GetRegisterUseCase(deps as any),
        submit: new (await import("../../src/modules/attendance/usecases/submit-register.usecase")).SubmitRegisterUseCase(deps as any),
        update: new (await import("../../src/modules/attendance/usecases/update-attendance.usecase")).UpdateAttendanceUseCase(deps as any),
        list:   new (await import("../../src/modules/attendance/usecases/list-attendance.usecase")).ListAttendanceUseCase(deps as any),
        student: new (await import("../../src/modules/attendance/usecases/attendance-summaries.usecases")).StudentSummaryUseCase(deps as any),
        klass:   new (await import("../../src/modules/attendance/usecases/attendance-summaries.usecases")).ClassSummaryUseCase(deps as any),
    });
    const teacherA = () => access("STAFF", S.tA.id, { "attendance.view": "ASSIGNED", "attendance.mark": "ASSIGNED" });   // leads JSS 1A
    const teacherB = () => access("STAFF", S.tB.id, { "attendance.view": "ASSIGNED", "attendance.mark": "ASSIGNED" });   // teaches JSS 2A this term
    const teacherC = () => access("STAFF", S.tC.id, { "attendance.view": "ASSIGNED", "attendance.mark": "ASSIGNED" });   // taught JSS 1A last term only
    const actorOf = (a: { userId: string }) => ({ userId: a.userId });
    const entries = (s: Array<[{ id: string }, string]>) => s.map(([st, status]) => ({ studentId: st.id, status }));
    const rows = (where: any = {}) => db().attendance.findMany({ where, orderBy: { createdAt: "asc" } });

    before(async () => { school = await createTestSchool(); deps = buildDeps(); S = await school.run(seed); });
    after(async () => { await school.drop(); });

    it("the migration works on a fresh school: new columns exist and can be used", () => school.run(async () => {
        const r = await db().attendance.create({ data: { studentId: S.s6.id, termId: S.term.id, date: new Date(`${day(-40)}T00:00:00Z`), status: "present" } });
        assert.equal(r.classId, null); assert.equal(r.markedById, null); assert.ok(r.updatedAt instanceof Date);
        await db().attendance.delete({ where: { id: r.id } });
    }));

    describe("who may open and take a register", () => {
        it("a class teacher opens their class: students by name, withdrawn students left off, nothing marked yet, can mark", () => school.run(async () => {
            const r = await (await uc()).get.execute(S.C1.id, day(-1), teacherA());
            assert.deepEqual(r.students.map(s => s.student.name), ["Ada Pupil", "Bola Pupil", "Chidi Pupil"]);
            assert.equal(r.summary.unmarked, 3); assert.equal(r.canMark, true); assert.equal(r.term.name, "first"); assert.equal(r.class.name, "JSS 1A");
        }));
        it("a teacher of another class cannot open it; neither can a teacher who taught it only last term", () => school.run(async () => {
            const { get, submit } = await uc();
            await assert.rejects(() => get.execute(S.C1.id, day(-1), teacherB()), (e: any) => e.statusCode === 403);
            await assert.rejects(() => get.execute(S.C1.id, day(-1), teacherC()), (e: any) => e.statusCode === 403, "last term's assignment gives nothing");
            await assert.rejects(() => submit.execute(school.schoolId, S.C1.id, { date: day(-1), entries: entries([[S.s1, "present"]]) } as any, teacherC(), actorOf(teacherC())), (e: any) => /lead or teach/.test(e.message));
            assert.equal((await rows()).length, 0);
        }));
        it("a teacher who teaches a subject in the class this term may open and mark it; the admin may do any class", () => school.run(async () => {
            const { get, submit } = await uc();
            assert.equal((await get.execute(S.C2.id, day(-1), teacherB())).students.length, 1);
            const r = await submit.execute(school.schoolId, S.C2.id, { date: day(-1), entries: entries([[S.s4, "present"]]) } as any, teacherB(), actorOf(teacherB()));
            assert.equal(r.created, 1);
            assert.equal((await get.execute(S.C1.id, day(-1), adminAccess())).students.length, 3);
        }));
        it("a student or guardian (OWN scope) cannot open class registers", () => school.run(async () => {
            const stu = access("STUDENT", S.s1.id, { "attendance.view": "OWN" });
            const { get } = await uc();
            await assert.rejects(() => get.execute(S.C1.id, day(-1), stu), (e: any) => e.statusCode === 403);
        }));
    });

    describe("day rules (nothing is saved when a rule refuses)", () => {
        const refuse = async (date: string, code: string) => school.run(async () => {
            const { submit } = await uc(); const before = (await rows()).length;
            await assert.rejects(() => submit.execute(school.schoolId, S.C1.id, { date, entries: entries([[S.s1, "present"]]) } as any, adminAccess(), { userId: "user-admin" }), (e: any) => e.code === code);
            assert.equal((await rows()).length, before);
        });
        it("a day that has not come yet", () => refuse(day(1), "ATTENDANCE_DATE_IN_FUTURE"));
        it("a day outside every term", () => refuse(day(-100), "ATTENDANCE_OUTSIDE_TERM"));
        it("a calendar holiday (and a non-holiday event does not close the register)", async () => {
            await refuse(day(-3), "ATTENDANCE_HOLIDAY");
            await school.run(async () => {
                const r = await (await uc()).get.execute(S.C1.id, day(-3), adminAccess());
                assert.equal(r.holiday, "Mid-term break"); assert.equal(r.canMark, false);
                assert.equal((await (await uc()).get.execute(S.C1.id, day(-4), adminAccess())).holiday, null);
            });
        });
        it("a date with a time, or not a real date", () => refuse("2026-10-26T15:00:00Z", "ATTENDANCE_DATE_INVALID"));
    });

    describe("taking the register", () => {
        it("saves valid students, skips the rest WITH a reason, finds the term from the date, records who marked", () => school.run(async () => {
            const a = teacherA(); const { submit } = await uc();
            const r = await submit.execute(school.schoolId, S.C1.id, { date: day(-1), entries: [
                ...entries([[S.s1, "present"], [S.s2, "late"], [S.s3, "absent"]]), { studentId: S.s6.id, status: "present" }, { studentId: S.s1.id, status: "absent" },
            ] } as any, a, actorOf(a));
            assert.equal(r.created, 3); assert.equal(r.updated, 0); assert.equal(r.term.name, "first");
            assert.deepEqual(r.skipped.map(s => [s.student?.name, s.reason]).sort(), [["Ada Pupil", "duplicate_entry"], ["Femi Pupil", "not_on_class_list"]]);
            assert.deepEqual(r.unmarked, []);
            const saved = await rows({ classId: S.C1.id });
            assert.equal(saved.length, 3);
            assert.ok(saved.every((x: any) => x.markedById === a.userId && x.termId === S.term.id && x.date.toISOString() === `${day(-1)}T00:00:00.000Z`));
            assert.equal(saved.find((x: any) => x.studentId === S.s1.id).status, "present", "the first entry for a student wins; the repeat is skipped");
            assert.equal(await db().attendance.count({ where: { studentId: S.s6.id } }), 0, "a student not on the list is never saved");
        }));
        it("sending the same register again is safe; a changed mark is updated and audited old to new with names", () => school.run(async () => {
            const a = teacherA(); const { submit } = await uc();
            const same = await submit.execute(school.schoolId, S.C1.id, { date: day(-1), entries: entries([[S.s1, "present"], [S.s2, "late"], [S.s3, "absent"]]) } as any, a, actorOf(a));
            assert.deepEqual([same.created, same.updated, same.unchanged], [0, 0, 3]);
            const ch = await submit.execute(school.schoolId, S.C1.id, { date: day(-1), entries: entries([[S.s3, "excused"]]) } as any, a, actorOf(a));
            assert.deepEqual([ch.created, ch.updated, ch.unchanged], [0, 1, 0]);
            assert.equal((await rows({ studentId: S.s3.id })).length, 1, "still one record per student per day");
            const audit = deps.audits.filter((x: any) => x.action === "attendance.register_submitted").pop();
            assert.deepEqual(audit.newValue.changes, [{ student: "Chidi Pupil", from: "absent", to: "excused" }]);
            assert.equal(audit.newValue.class, "JSS 1A");
        }));
        it("unmarked students are reported", () => school.run(async () => {
            const a = teacherA(); const r = await (await uc()).submit.execute(school.schoolId, S.C1.id, { date: day(-2), entries: entries([[S.s1, "present"]]) } as any, a, actorOf(a));
            assert.deepEqual(r.unmarked.map(s => s.name), ["Bola Pupil", "Chidi Pupil"]);
        }));
    });

    describe("correcting a mark (48-hour window, override)", () => {
        const idOf = (studentId: string, date: string) => db().attendance.findFirst({ where: { studentId, date: new Date(`${date}T00:00:00Z`) } }).then((r: any) => r.id);
        it("inside the window the class teacher can correct it; a teacher of another class cannot", () => school.run(async () => {
            const { update } = await uc(); const id = await idOf(S.s2.id, day(-1));
            await assert.rejects(() => update.execute(school.schoolId, id, { status: "absent" } as any, teacherB(), actorOf(teacherB())), (e: any) => /lead or teach/.test(e.message));
            const r = await update.execute(school.schoolId, id, { status: "absent", note: "Came at noon" } as any, teacherA(), actorOf(teacherA()));
            assert.equal(r.status, "absent"); assert.equal(r.note, "Came at noon");
            assert.equal(r.student?.name, "Bola Pupil"); assert.equal(r.class?.name, "JSS 1A"); assert.equal(r.term?.name, "first"); assert.ok(r.markedBy?.name);
            const a = deps.audits.filter((x: any) => x.action === "attendance.updated").pop();
            assert.equal(a.oldValue.status, "late"); assert.equal(a.oldValue.student, "Bola Pupil"); assert.equal(a.newValue.afterEditWindow, false);
        }));
        it("after the window only someone with the override permission can correct it (by update or by re-sending the register)", () => school.run(async () => {
            const { update, submit } = await uc(); const id = await idOf(S.s1.id, day(-1));
            await db().attendance.update({ where: { id }, data: { createdAt: new Date(Date.now() - 49 * 3_600_000) } });
            await assert.rejects(() => update.execute(school.schoolId, id, { status: "absent" } as any, teacherA(), actorOf(teacherA())), (e: any) => e.code === "ATTENDANCE_EDIT_WINDOW_CLOSED");
            const re = await submit.execute(school.schoolId, S.C1.id, { date: day(-1), entries: entries([[S.s1, "absent"]]) } as any, teacherA(), actorOf(teacherA()));
            assert.deepEqual(re.skipped.map(s => s.reason), ["edit_window_closed"]);
            assert.equal((await db().attendance.findUnique({ where: { id } })).status, "present", "unchanged");
            const r = await update.execute(school.schoolId, id, { status: "excused" } as any, adminAccess(), { userId: "user-admin" });
            assert.equal(r.status, "excused");
            assert.equal(deps.audits.filter((x: any) => x.action === "attendance.updated").pop().newValue.afterEditWindow, true);
        }));
        it("an old record (taken before registers had a class) can only be corrected by someone with the ALL scope", () => school.run(async () => {
            const { update } = await uc();
            const old = await db().attendance.create({ data: { studentId: S.s2.id, termId: S.term.id, date: new Date(`${day(-9)}T00:00:00Z`), status: "present" } });
            await assert.rejects(() => update.execute(school.schoolId, old.id, { status: "absent" } as any, teacherA(), actorOf(teacherA())), (e: any) => /lead or teach/.test(e.message));
            assert.equal((await update.execute(school.schoolId, old.id, { status: "absent" } as any, adminAccess(), { userId: "user-admin" })).status, "absent");
        }));
    });

    describe("seeing attendance (scope)", () => {
        it("the admin sees everything; a class teacher only their own class; names are in every row", () => school.run(async () => {
            const { list } = await uc(); const q = { page: 1, limit: 100 } as any;
            const all = await list.execute(q, adminAccess());
            const mine = await list.execute(q, teacherA());
            assert.ok(all.meta.total > mine.meta.total);
            assert.ok(mine.data.every(r => r.class?.name === "JSS 1A"), "no JSS 2A marks for the JSS 1A teacher");
            assert.ok(all.data.some(r => r.class?.name === "JSS 2A"));
            const row = mine.data[0]; assert.ok(row.student?.name && row.term?.session?.name && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
            assert.equal((await list.execute(q, teacherC())).meta.total, 0, "a teacher with no class sees nothing");
        }));
        it("a student sees only their own; a guardian only their child's", () => school.run(async () => {
            const { list } = await uc(); const q = { page: 1, limit: 100 } as any;
            const stu = await list.execute(q, access("STUDENT", S.s1.id, { "attendance.view": "OWN" }));
            assert.ok(stu.data.length > 0 && stu.data.every(r => r.student?.id === S.s1.id));
            const parent = await list.execute(q, access("GUARDIAN", S.guardian.id, { "attendance.view": "OWN" }));
            assert.deepEqual([...new Set(parent.data.map(r => r.student?.id))], [S.s1.id]);
            const other = await list.execute(q, access("STUDENT", S.s4.id, { "attendance.view": "OWN" }));
            assert.ok(other.data.every(r => r.student?.id === S.s4.id));
        }));
        it("filters can narrow but never widen what a person may see; page size is capped at 100", () => school.run(async () => {
            const { list } = await uc();
            const stuAccess = access("STUDENT", S.s1.id, { "attendance.view": "OWN" });
            assert.equal((await list.execute({ page: 1, limit: 20, studentId: S.s2.id } as any, stuAccess)).meta.total, 0, "asking for someone else's records finds nothing");
            const { ListAttendanceQuery } = await import("../../src/modules/attendance/dtos/attendance.dto");
            assert.equal(ListAttendanceQuery.safeParse({ limit: 101 }).success, false);
            assert.equal((await list.execute({ page: 1, limit: 20, from: day(-1), to: day(-1) } as any, adminAccess())).data.every(r => r.date === day(-1)), true);
        }));
    });

    describe("summaries", () => {
        it("a student's summary: rate leaves excused out; days nobody marked are counted separately", () => school.run(async () => {
            const { student } = await uc();
            // Ada so far: excused on day(-1) (an admin corrected it), present on day(-2). Add three more days.
            for (const [d, st] of [[-5, "present"], [-6, "late"], [-7, "absent"]] as const) await db().attendance.create({ data: { studentId: S.s1.id, classId: S.C1.id, termId: S.term.id, date: new Date(`${day(d)}T00:00:00Z`), status: st } });
            const r = await student.execute({ studentId: S.s1.id } as any, adminAccess());
            assert.deepEqual([r.present, r.late, r.absent, r.excused], [2, 1, 1, 1]);
            assert.equal(r.rate, 75);                                   // (2 + 1) / (2 + 1 + 1); excused is left out
            assert.equal(r.timesPresent, 3); assert.equal(r.daysMarked, 5);
            assert.equal(r.registerDays, 5);                            // JSS 1A had registers on day -1, -2, -5, -6, -7
            assert.equal(r.unmarked, 0);
            assert.equal(r.lowAttendance, false);
            assert.equal(r.class?.name, "JSS 1A"); assert.equal(r.student.name, "Ada Pupil");
        }));
        it("a student with only an excused day has no rate (never a made-up 0% or 100%), and the days nobody marked are reported", () => school.run(async () => {
            const r = await (await uc()).student.execute({ studentId: S.s3.id } as any, adminAccess());
            assert.equal(r.excused, 1); assert.equal(r.rate, null); assert.equal(r.lowAttendance, false);
            assert.equal(r.daysMarked, 1); assert.equal(r.registerDays, 5); assert.equal(r.unmarked, 4);
        }));
        it("a guardian can read their child's summary but not another child's", () => school.run(async () => {
            const { student } = await uc(); const g = access("GUARDIAN", S.guardian.id, { "attendance.view": "OWN" });
            assert.equal((await student.execute({ studentId: S.s1.id } as any, g)).daysMarked, 5);
            assert.equal((await student.execute({ studentId: S.s4.id } as any, g)).daysMarked, 0, "not their child: nothing is shown");
        }));
        it("a class summary: every student on the list, class rate, and the same access rules as the register", () => school.run(async () => {
            const { klass } = await uc();
            const r = await klass.execute(S.C1.id, {} as any, teacherA());
            assert.deepEqual(r.students.map(s => s.student.name), ["Ada Pupil", "Bola Pupil", "Chidi Pupil"]);
            assert.ok(r.classSummary.rate !== null && r.registerDays === 5);
            await assert.rejects(() => klass.execute(S.C1.id, {} as any, teacherB()), (e: any) => e.statusCode === 403);
        }));
    });

    describe("old records and two people at once", () => {
        it("an old record saved with a clock time is found and fixed, never duplicated", () => school.run(async () => {
            const { submit } = await uc();
            await db().attendance.create({ data: { studentId: S.s2.id, termId: S.term.id, date: new Date(`${day(-10)}T15:00:00Z`), status: "absent" } });
            const a = adminAccess();
            const r = await submit.execute(school.schoolId, S.C1.id, { date: day(-10), entries: entries([[S.s2, "present"]]) } as any, a, { userId: "user-admin" });
            assert.deepEqual([r.created, r.updated], [0, 1]);
            const all = await rows({ studentId: S.s2.id, date: { gte: new Date(`${day(-10)}T00:00:00Z`), lt: new Date(`${day(-9)}T00:00:00Z`) } });
            assert.equal(all.length, 1);
            assert.equal(all[0].date.toISOString(), `${day(-10)}T00:00:00.000Z`, "normalised to the school day");
            assert.equal(all[0].classId, S.C1.id);
        }));
        it("two people submitting the same register at the same moment: no errors, no duplicates, one final answer", () => school.run(async () => {
            const { submit } = await uc(); const a = adminAccess();
            const call = (status: string) => school.run(() => submit.execute(school.schoolId, S.C1.id, { date: day(-12), entries: entries([[S.s1, status], [S.s2, status], [S.s3, status]]) } as any, a, { userId: "user-" + status }));
            const [x, y] = await Promise.all([call("present"), call("absent")]);
            assert.equal(x.created + y.created, 3, "each student created exactly once");
            const all = await rows({ date: new Date(`${day(-12)}T00:00:00Z`) });
            assert.equal(all.length, 3);
            assert.equal(new Set(all.map((r: any) => r.status)).size, 1, "the whole register ends with one person's answer, never a mix");
        }));
    });
});
