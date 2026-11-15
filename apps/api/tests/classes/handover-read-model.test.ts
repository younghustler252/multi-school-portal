/*
| OUTSTANDING TEACHER HANDOVER (read-only): which assignments still point at staff who have left.
| Agreed rules under test:
|   - a class they lead is outstanding, whatever their mark sheets look like
|   - a subject assignment in the current or a future term is outstanding unless its sheet is PUBLISHED or LOCKED
|   - finished sheets are shown as "completed" (ownership is not hidden) but are not outstanding
|   - past-term assignments are history: counted, never listed
|   - a subject default pointing at someone who left is listed
|   - derived from live data: reactivating a teacher, or reassigning, makes it disappear; nothing is written
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { assembleHandover, isFinishedSheet, loadOutstandingHandover, type HandoverRows } from "../../src/modules/classes/services/handover.read-model";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { seed, day } from "../attendance/fixtures";

describe("pure classification", () => {
    const base = (): HandoverRows => ({
        staff: [{ id: "t1", firstName: "Ada", lastName: "Obi", category: "teaching", exitDate: new Date("2026-10-01"), exitReason: "resigned" }],
        classesLed: [], defaults: [], subjects: [],
    });
    const subj = (o: Partial<HandoverRows["subjects"][number]>) => ({ staffId: "t1", classSubjectId: "cs", classId: "c", className: "JSS 1A", branchId: "b", subjectName: "Maths", termId: "t", termName: "first", isCurrent: true, startsInFuture: false, sheetStatus: null as string | null, ...o });

    it("only published and locked sheets are finished", () => {
        for (const [s, finished] of [["published", true], ["locked", true], ["draft", false], ["submitted", false], ["approved", false], [null, false]] as const) assert.equal(isFinishedSheet(s), finished, String(s));
    });
    it("unfinished sheets and sheets not started are outstanding; finished sheets are completed, not outstanding", () => {
        const rows = base(); rows.subjects = [subj({ classSubjectId: "a", sheetStatus: null }), subj({ classSubjectId: "b", sheetStatus: "draft" }), subj({ classSubjectId: "c", sheetStatus: "submitted" }), subj({ classSubjectId: "d", sheetStatus: "approved" }), subj({ classSubjectId: "e", sheetStatus: "published" }), subj({ classSubjectId: "f", sheetStatus: "locked" })];
        const r = assembleHandover(rows, new Date());
        assert.deepEqual(r.teachers[0].outstandingSubjects.map(s => s.classSubjectId), ["a", "b", "c", "d"]);
        assert.deepEqual(r.teachers[0].completedSubjects.map(s => s.classSubjectId), ["e", "f"]);
    });
    it("a class they lead is outstanding even when every sheet of theirs is finished", () => {
        const rows = base(); rows.classesLed = [{ staffId: "t1", classId: "c", className: "JSS 1A", branchId: "b" }]; rows.subjects = [subj({ sheetStatus: "locked" })];
        const r = assembleHandover(rows, new Date());
        assert.equal(r.teachers.length, 1); assert.equal(r.totals.classesLed, 1); assert.equal(r.totals.outstandingSubjects, 0);
        assert.equal(r.teachers[0].completedSubjects.length, 1, "ownership of the finished subject is still shown");
    });
    it("someone left with only finished work needs no action and is counted separately", () => {
        const rows = base(); rows.subjects = [subj({ sheetStatus: "published" })];
        const r = assembleHandover(rows, new Date());
        assert.deepEqual(r.teachers, []); assert.equal(r.totals.teachersWithOnlyFinishedWork, 1); assert.equal(r.totals.teachersNeedingAttention, 0);
    });
    it("past terms are history: counted, never listed or outstanding", () => {
        const rows = base(); rows.classesLed = [{ staffId: "t1", classId: "c", className: "X", branchId: "b" }];
        rows.subjects = [subj({ isCurrent: false, startsInFuture: false, sheetStatus: "draft" }), subj({ classSubjectId: "now", sheetStatus: "draft" })];
        const t = assembleHandover(rows, new Date()).teachers[0];
        assert.equal(t.pastTermAssignments, 1); assert.deepEqual(t.outstandingSubjects.map(s => s.classSubjectId), ["now"]);
    });
    it("an upcoming term counts as outstanding (nothing has started, so no sheet)", () => {
        const rows = base(); rows.subjects = [subj({ isCurrent: false, startsInFuture: true, sheetStatus: null })];
        assert.equal(assembleHandover(rows, new Date()).totals.outstandingSubjects, 1);
    });
    it("a default teacher who left is listed on its own", () => {
        const rows = base(); rows.defaults = [{ staffId: "t1", subjectId: "s", subjectName: "Biology" }];
        const r = assembleHandover(rows, new Date());
        assert.equal(r.totals.defaultsToUpdate, 1); assert.equal(r.teachers.length, 1);
    });
    it("nobody left: an empty report", () => {
        assert.deepEqual(assembleHandover({ staff: [], classesLed: [], subjects: [], defaults: [] }, new Date()).totals, { teachersNeedingAttention: 0, classesLed: 0, outstandingSubjects: 0, defaultsToUpdate: 0, completedSubjects: 0, teachersWithOnlyFinishedWork: 0 });
    });
});

describe("outstanding handover on a real school schema", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool; let pool: Pool; let W: any;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const read = async (opts: { branchIds?: string[] | null } = {}) => {
        const c = await pool.connect();
        try { await c.query("BEGIN READ ONLY"); await c.query(`SET LOCAL search_path TO "${school.schemaName}"`); const r = await loadOutstandingHandover(c, opts); await c.query("ROLLBACK"); return r; }
        finally { c.release(); }
    };
    const names = (r: Awaited<ReturnType<typeof read>>) => r.teachers.map(t => t.staff.name).sort();
    const teacher = (r: Awaited<ReturnType<typeof read>>, first: string) => r.teachers.find(t => t.staff.name.startsWith(first))!;

    before(async () => {
        school = await createTestSchool(); pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
        W = await school.run(async () => {
            const S = await seed();                       // tA leads C1; tB teaches a subject in C2 this term; tC taught C1 only LAST term
            const d = db();
            const north = await d.branch.create({ data: { name: "North", code: "NORTH" } });
            const C3 = await d.class.create({ data: { name: "JSS 3N", branchId: north.id } });
            const mk = (firstName: string, extra: any = {}) => d.staff.create({ data: { firstName, lastName: "Teacher", category: "teaching", ...extra } });
            const tD = await mk("Dayo"), tE = await mk("Efe"), tF = await mk("Femi"), tG = await mk("Gola"), tH = await mk("Halima"), tN = await mk("Nkem");
            const subject = (name: string, defaultTeacherId?: string) => d.subject.create({ data: { name, ...(defaultTeacherId && { defaultTeacherId }) } });
            const [m, e, p, b, h] = [await subject("Maths-h"), await subject("English-h"), await subject("Physics-h"), await subject("Biology-h", tH.id), await subject("History-h")];
            const future = await d.term.create({ data: { sessionId: S.session.id, name: "third", startDate: new Date(`${day(60)}T00:00:00Z`), endDate: new Date(`${day(120)}T00:00:00Z`), isCurrent: false } });
            const cs = (classId: string, subjectId: string, staffId: string, termId: string) => d.classSubject.create({ data: { classId, subjectId, staffId, termId } });
            const sheet = (classSubjectId: string, status: string) => d.resultSheet.create({ data: { classSubjectId, status, components: [] } });

            const dDraft = await cs(S.C2.id, m.id, tD.id, S.term.id);     await sheet(dDraft.id, "draft");        // Dayo: unfinished
            const dDone  = await cs(S.C2.id, e.id, tD.id, S.term.id);     await sheet(dDone.id, "published");     //       and one finished
            const eDone  = await cs(S.C2.id, p.id, tE.id, S.term.id);     await sheet(eDone.id, "locked");        // Efe: only finished work
            const fSoon  = await cs(S.C2.id, b.id, tF.id, future.id);                                             // Femi: upcoming term, no sheet
            await cs(S.C1.id, h.id, tG.id, S.oldTerm.id);                                                         // Gola: past term only (history)
            await cs(S.C1.id, m.id, tD.id, S.oldTerm.id);                                                         // Dayo also taught last term (history)
            const nLeads = await d.class.update({ where: { id: C3.id }, data: { classTeacherId: tN.id } });       // Nkem leads the North class
            void dDraft; void nLeads; void fSoon;

            // who has left: tA (leads C1), tB (a subject, no sheet), tD, tE, tF, tG, tH (default of Biology), tN; tC stays active
            const gone = [S.tA, S.tB, tD, tE, tF, tG, tH, tN];
            for (const t of gone) await d.staff.update({ where: { id: t.id }, data: { isActive: false, exitDate: new Date(`${day(-5)}T00:00:00Z`), exitReason: "left" } });
            return { S, north, C3, tD, tE, tF, tG, tH, tN };
        });
    });
    after(async () => { await pool.end(); await school.drop(); });

    it("lists exactly the people who left with something to hand over (not Efe: finished work only; not Gola: history only)", async () => {
        const r = await read();
        assert.deepEqual(names(r), ["Bisi Teacher", "Dayo Teacher", "Femi Teacher", "Halima Teacher", "Nkem Teacher", "Tola Teacher"]);
        const who = r.teachers.map(t => t.staff.id);
        assert.ok(who.includes(W.S.tA.id) && who.includes(W.S.tB.id) && who.includes(W.tD.id) && who.includes(W.tF.id) && who.includes(W.tH.id) && who.includes(W.tN.id));
        assert.ok(!who.includes(W.tE.id), "only finished work: no action needed");
        assert.ok(!who.includes(W.tG.id), "only a past term: history");
        assert.ok(!who.includes(W.S.tC.id), "an active teacher is never listed");
        assert.equal(r.totals.teachersWithOnlyFinishedWork, 1);
    });
    it("a class they led is outstanding", async () => {
        const r = await read();
        assert.deepEqual(teacher(r, "Tola").classesLed.map(c => c.className), ["JSS 1A"]);
        assert.deepEqual(teacher(r, "Nkem").classesLed.map(c => c.className), ["JSS 3N"]);
    });
    it("a subject with no sheet yet, and one with a draft sheet, are outstanding; the published one is completed", async () => {
        const r = await read();
        assert.deepEqual(teacher(r, "Bisi").outstandingSubjects.map(s => s.sheetStatus), [null]);
        const dayo = teacher(r, "Dayo");
        assert.deepEqual(dayo.outstandingSubjects.map(s => [s.subjectName, s.sheetStatus]), [["Maths-h", "draft"]]);
        assert.deepEqual(dayo.completedSubjects.map(s => [s.subjectName, s.sheetStatus]), [["English-h", "published"]], "ownership shown, no action needed");
    });
    it("an upcoming term's assignment is outstanding", async () => {
        const f = teacher(await read(), "Femi").outstandingSubjects;
        assert.equal(f.length, 1); assert.equal(f[0].isCurrentTerm, false); assert.equal(f[0].termName, "third");
    });
    it("a past term is history: counted on the person, never listed", async () => {
        const r = await read();
        assert.ok(!r.teachers.some(t => [...t.outstandingSubjects, ...t.completedSubjects].some(x => x.termName === "second")), "no past-term row is listed anywhere");
        assert.equal(teacher(r, "Dayo").pastTermAssignments, 1);
    });
    it("a subject default pointing at someone who left is listed", async () => {
        assert.deepEqual(teacher(await read(), "Halima").defaultsToUpdate.map(d => d.subjectName), ["Biology-h"]);
    });
    it("a branch-scoped viewer sees only their branch's classes, and no school-wide defaults", async () => {
        const north = await read({ branchIds: [W.north.id] });
        assert.deepEqual(north.teachers.map(t => t.staff.name), ["Nkem Teacher"]);
        assert.equal(north.totals.defaultsToUpdate, 0);
        const main = await read({ branchIds: [W.S.C1.branchId] });
        assert.ok(!main.teachers.some(t => t.staff.name.startsWith("Nkem")));
        assert.deepEqual(await read({ branchIds: [] }).then(r => r.teachers), [], "no branches: nothing");
    });
    it("reactivating a teacher makes them disappear: nothing is stored, it is derived", async () => {
        await school.run(() => db().staff.update({ where: { id: W.tN.id }, data: { isActive: true, exitDate: null, exitReason: null } }));
        try { assert.ok(!(await read()).teachers.some(t => t.staff.name.startsWith("Nkem"))); }
        finally { await school.run(() => db().staff.update({ where: { id: W.tN.id }, data: { isActive: false, exitDate: new Date(`${day(-5)}T00:00:00Z`) } })); }
    });
    it("reassigning clears it: point the class at an active teacher and Tola's handover is gone", async () => {
        await school.run(() => db().class.update({ where: { id: W.S.C1.id }, data: { classTeacherId: W.S.tC.id } }));
        try { assert.ok(!(await read()).teachers.some(t => t.staff.name.startsWith("Tola"))); }
        finally { await school.run(() => db().class.update({ where: { id: W.S.C1.id }, data: { classTeacherId: W.S.tA.id } })); }
    });
    it("reading changes nothing (a READ ONLY transaction: a write inside it is refused)", async () => {
        const before = await school.run(async () => [await db().staff.count(), await db().class.count(), await db().classSubject.count()]);
        await read();
        const c = await pool.connect();
        try { await c.query("BEGIN READ ONLY"); await c.query(`SET LOCAL search_path TO "${school.schemaName}"`); await assert.rejects(c.query(`UPDATE "Staff" SET "isActive" = true`), /read-only transaction/); await c.query("ROLLBACK"); } finally { c.release(); }
        assert.deepEqual(await school.run(async () => [await db().staff.count(), await db().class.count(), await db().classSubject.count()]), before);
    });
});
