/*
| TEACHER HANDOVER REPORT: synthetic edge cases (there is no real school data yet).
| Fixed absolute dates and an explicit "today" are used throughout, so nothing here depends on the real clock.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { loadOutstandingHandover } from "../../src/modules/classes/services/handover.read-model";
import { reportAcrossSchools, schoolLocalDate, formatSchoolResult, parseReportArgs, type SchoolRef } from "../../src/modules/classes/services/handover-report.runner";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { seed } from "../attendance/fixtures";

describe("schoolLocalDate and argument parsing", () => {
    it("the school's own calendar date, not UTC's", () => {
        const late = new Date("2030-09-09T23:30:00Z");               // 00:30 on the 10th in Lagos (UTC+1)
        assert.equal(schoolLocalDate(late, "Africa/Lagos"), "2030-09-10");
        assert.equal(schoolLocalDate(late, "UTC"), "2030-09-09");
        assert.equal(schoolLocalDate(new Date("2030-01-01T00:30:00Z"), "America/New_York"), "2029-12-31", "behind UTC");
    });
    it("an unknown or missing timezone falls back to UTC rather than failing", () => {
        const d = new Date("2030-09-09T23:30:00Z");
        assert.equal(schoolLocalDate(d, "Not/AZone"), "2030-09-09"); assert.equal(schoolLocalDate(d, null), "2030-09-09"); assert.equal(schoolLocalDate(d, undefined), "2030-09-09");
    });
    it("--json needs a path; anything else is an error (a typo must not silently skip the file)", () => {
        assert.deepEqual(parseReportArgs([]), { jsonPath: null });
        assert.deepEqual(parseReportArgs(["--json", "out.json"]), { jsonPath: "out.json" });
        assert.throws(() => parseReportArgs(["--json"]), /needs a file path/);
        assert.throws(() => parseReportArgs(["--json", "--other"]), /needs a file path/);
        assert.throws(() => parseReportArgs(["--jsn", "x"]), /unknown option "--jsn"/);
        assert.throws(() => parseReportArgs(["out.json"]), /unknown option/);
    });
    it("a malformed 'today' is refused before any query runs", async () => {
        const client = { query: async () => { throw new Error("must not query"); } };
        for (const bad of ["2030-9-1", "tomorrow", "", "2030-09-10T00:00"]) await assert.rejects(loadOutstandingHandover(client as any, { today: bad }), /today must be YYYY-MM-DD/);
    });
});

describe("handover edge cases on real school schemas", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let A: TestSchool, B: TestSchool, pool: Pool; let W: any;
    const dbOf = (s: TestSchool) => () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const dbA = dbOf(null as any);
    const FIXED_NOW = new Date("2030-09-09T23:30:00Z");               // 2030-09-10 in Lagos, 2030-09-09 in UTC
    const read = async (s: TestSchool, opts: Parameters<typeof loadOutstandingHandover>[1] = {}) => {
        const c = await pool.connect();
        try { await c.query("BEGIN READ ONLY"); await c.query(`SET LOCAL search_path TO "${s.schemaName}"`); const r = await loadOutstandingHandover(c, { now: FIXED_NOW, ...opts }); await c.query("ROLLBACK"); return r; }
        finally { c.release(); }
    };
    const person = (r: Awaited<ReturnType<typeof read>>, first: string) => r.teachers.find(t => t.staff.name.startsWith(first));
    const left = (id: string) => A.run(() => dbA().staff.update({ where: { id }, data: { isActive: false, exitDate: new Date("2030-09-01T00:00:00Z"), exitReason: "left" } }));

    before(async () => {
        A = await createTestSchool(); B = await createTestSchool(); pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
        W = await A.run(async () => {
            const S = await seed(); const d = dbA();
            const mk = (first: string, extra: any = {}) => d.staff.create({ data: { firstName: first, lastName: "Edge", category: "teaching", ...extra } });
            const sub = (name: string) => d.subject.create({ data: { name } });
            const cs = (classId: string, subjectId: string, staffId: string, termId: string) => d.classSubject.create({ data: { classId, subjectId, staffId, termId } });
            const session = (name: string) => d.session.create({ data: { name, startDate: new Date("2029-01-01T00:00:00Z"), endDate: new Date("2031-12-31T00:00:00Z"), isCurrent: false } });
            const term = async (sess: string, startsOn: string, endsOn: string, isCurrent = false) => d.term.create({ data: { sessionId: (await session(sess)).id, name: "first", startDate: new Date(`${startsOn}T00:00:00Z`), endDate: new Date(`${endsOn}T00:00:00Z`), isCurrent } });

            // ---- the boundary teacher: one assignment in each kind of term (today is 2030-09-10)
            const edge = await mk("Boundary"); const m = await sub("Edge-Maths");
            const tToday = await term("2030/A", "2030-09-10", "2030-12-10");     // starts TODAY, not yet flagged current
            const tTomorrow = await term("2030/B", "2030-09-11", "2030-12-11");  // starts tomorrow
            const tYesterday = await term("2030/C", "2030-09-09", "2030-12-09"); // started yesterday, not flagged current
            const tEnded = await term("2030/D", "2030-01-01", "2030-04-01");     // ended months ago
            const tEarly = await term("2030/E", "2031-01-10", "2031-04-10", true); // flagged current although it starts in the future
            for (const t of [tToday, tTomorrow, tYesterday, tEnded, tEarly]) await cs(S.C1.id, m.id, edge.id, t.id);

            // ---- every sheet status, so each enum value is proven to flow through the query
            const stat = await mk("Status");
            const statuses: (string | null)[] = [null, "draft", "submitted", "approved", "published", "locked"];
            for (const st of statuses) { const c = await cs(S.C2.id, await sub(`Stat-${st ?? "none"}`).then((x: any) => x.id), stat.id, S.term.id); if (st) await d.resultSheet.create({ data: { classSubjectId: c.id, status: st, components: [] } }); }

            // ---- shapes of ownership
            const multiLead = await mk("Leader"); const idle = await mk("Idle"), noDate = await mk("Nodate"), twin = await mk("Twin");
            const extraClasses = [await d.class.create({ data: { name: "Edge A", branchId: S.C1.branchId, classTeacherId: multiLead.id } }), await d.class.create({ data: { name: "Edge B", branchId: S.C1.branchId, classTeacherId: multiLead.id } }), await d.class.create({ data: { name: "Edge C", branchId: S.C1.branchId, classTeacherId: multiLead.id } })];
            await d.class.create({ data: { name: "Edge D", branchId: S.C1.branchId, classTeacherId: noDate.id } });
            const same = await sub("Edge-Twin"); await cs(S.C1.id, same.id, twin.id, S.term.id); await cs(S.C2.id, same.id, twin.id, S.term.id);   // one subject in two classes

            for (const t of [edge, stat, multiLead, idle, noDate, twin]) await left(t.id);
            await d.staff.update({ where: { id: noDate.id }, data: { exitDate: null, exitReason: null } });
            return { S, edge, stat, multiLead, idle, noDate, twin, extraClasses, tToday, tTomorrow, tYesterday, tEnded, tEarly };
        });
        await B.run(() => seed());                                                  // a second school where nobody has left
    });
    after(async () => { await pool.end(); await A.drop(); await B.drop(); });

    describe("which terms count (today = 2030-09-10)", () => {
        it("a term starting TODAY (not yet flagged current) is upcoming; so is one starting tomorrow", async () => {
            const e = person(await read(A, { today: "2030-09-10" }), "Boundary")!;
            const upcoming = e.outstandingSubjects.filter(s => !s.isCurrentTerm).map(s => s.termId);
            assert.ok(upcoming.includes(W.tToday.id), "starts today"); assert.ok(upcoming.includes(W.tTomorrow.id), "starts tomorrow");
        });
        it("a term that started yesterday without being flagged current, and one that ended long ago, are history", async () => {
            const e = person(await read(A, { today: "2030-09-10" }), "Boundary")!;
            const listed = e.outstandingSubjects.map(s => s.termId);
            assert.ok(!listed.includes(W.tYesterday.id)); assert.ok(!listed.includes(W.tEnded.id));
            assert.equal(e.pastTermAssignments, 2, "both are counted as history, not dropped silently");
        });
        it("a term flagged current counts as current even if its dates say it has not started", async () => {
            const e = person(await read(A, { today: "2030-09-10" }), "Boundary")!;
            const early = e.outstandingSubjects.find(s => s.termId === W.tEarly.id)!;
            assert.equal(early.isCurrentTerm, true);
        });
        it("the school's own date decides: a term starting on the 9th is upcoming on the 9th but history on the 10th", async () => {
            const onNinth = person(await read(A, { today: "2030-09-09" }), "Boundary")!;
            assert.ok(onNinth.outstandingSubjects.some(s => s.termId === W.tYesterday.id), "still upcoming when today is the 9th");
            const onTenth = person(await read(A, { today: "2030-09-10" }), "Boundary")!;
            assert.ok(!onTenth.outstandingSubjects.some(s => s.termId === W.tYesterday.id));
        });
        it("between terms (no term flagged current): the class they led stays outstanding; the just-ended term is history; the next term is outstanding", async () => {
            await A.run(() => dbA().term.updateMany({ data: { isCurrent: false } }));
            try {
                const r = await read(A, { today: "2030-09-10" });
                assert.equal(person(r, "Leader")!.classesLed.length, 3, "a class lead does not depend on any term");
                const stat = person(r, "Status");
                assert.ok(!stat || stat.outstandingSubjects.length === 0, "the old current term is now past: history");
                assert.ok(person(r, "Boundary")!.outstandingSubjects.some(s => s.termId === W.tToday.id), "the term starting today is next");
            } finally {
                await A.run(async () => { await dbA().term.update({ where: { id: W.S.term.id }, data: { isCurrent: true } }); await dbA().term.update({ where: { id: W.tEarly.id }, data: { isCurrent: true } }); });
            }
        });
    });

    describe("mark sheet states", () => {
        it("none, draft, submitted and approved are outstanding; published and locked are completed", async () => {
            const s = person(await read(A, { today: "2030-09-10" }), "Status")!;
            assert.deepEqual(s.outstandingSubjects.map(x => x.sheetStatus).sort(), [null, "approved", "draft", "submitted"].sort());
            assert.deepEqual(s.completedSubjects.map(x => x.sheetStatus).sort(), ["locked", "published"]);
        });
    });

    describe("shapes of ownership", () => {
        it("someone who leads several classes lists them all", async () => {
            assert.deepEqual(person(await read(A, { today: "2030-09-10" }), "Leader")!.classesLed.map(c => c.className).sort(), ["Edge A", "Edge B", "Edge C"]);
        });
        it("one subject taught in two classes is two assignments (no duplicate or missing rows)", async () => {
            const t = person(await read(A, { today: "2030-09-10" }), "Twin")!;
            assert.deepEqual(t.outstandingSubjects.map(x => x.className).sort(), ["JSS 1A", "JSS 2A"]);
            assert.equal(new Set(t.outstandingSubjects.map(x => x.classSubjectId)).size, 2);
        });
        it("a departed person with nothing assigned is not listed", async () => {
            assert.equal(person(await read(A, { today: "2030-09-10" }), "Idle"), undefined);
        });
        it("a missing exit date is reported as not recorded, not as an error", async () => {
            const n = person(await read(A, { today: "2030-09-10" }), "Nodate")!;
            assert.equal(n.staff.exitDate, null);
            assert.ok(formatSchoolResult({ schoolId: "x", school: "S", report: { generatedAt: "", teachers: [n], totals: { teachersNeedingAttention: 1, classesLed: 1, outstandingSubjects: 0, defaultsToUpdate: 0, completedSubjects: 0, teachersWithOnlyFinishedWork: 0 } } }).join("\n").includes("date not recorded"));
        });
        it("people are listed in name order, and a repeat read is identical", async () => {
            const a = await read(A, { today: "2030-09-10" }), b = await read(A, { today: "2030-09-10" });
            const names = a.teachers.map(t => t.staff.name); assert.deepEqual(names, [...names].sort((x, y) => x.localeCompare(y)));
            assert.deepEqual(a, b);
        });
        it("the report is plain data: it survives a JSON round trip unchanged", async () => {
            const a = await read(A, { today: "2030-09-10" }); assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
        });
    });

    describe("across schools", () => {
        const refs = (): SchoolRef[] => [
            { id: "A-lagos", name: "School A (Lagos)", schemaName: A.schemaName, timezone: "Africa/Lagos" },
            { id: "gone", name: "Dropped schema", schemaName: "no_such_schema_zz", timezone: "UTC" },
            { id: "B", name: "School B", schemaName: B.schemaName, timezone: "Africa/Lagos" },
            { id: "new", name: "Not provisioned", schemaName: null },
            { id: "evil", name: "Odd name", schemaName: 'x"; DROP SCHEMA public; --' },
            { id: "A-utc", name: "School A (read as UTC)", schemaName: A.schemaName, timezone: "UTC" },
        ];
        const counts = async () => [await A.run(() => dbA().staff.count()), await A.run(() => dbA().classSubject.count()), await A.run(() => dbA().class.count())];

        it("reads every readable school, skips unprovisioned ones, and records the ones it cannot read without stopping", async () => {
            const r = await reportAcrossSchools({ schools: refs(), pool, now: FIXED_NOW });
            assert.deepEqual(r.results.map(x => x.schoolId), ["A-lagos", "B", "A-utc"], "the schools after a failing one are still read");
            assert.deepEqual(r.skipped.map(x => x.schoolId), ["new"]);
            assert.deepEqual(r.failures.map(x => x.schoolId), ["gone", "evil"]);
            assert.match(r.failures[0].error, /relation .* does not exist|Staff/); assert.match(r.failures[1].error, /unusual schema name/);
            assert.deepEqual([r.summary.schoolsRead, r.summary.schoolsSkipped, r.summary.schoolsFailed], [3, 1, 2]);
        });
        it("a school where nobody has left reports nothing outstanding, and is not counted as having a handover", async () => {
            const r = await reportAcrossSchools({ schools: refs(), pool, now: FIXED_NOW });
            const b = r.results.find(x => x.schoolId === "B")!; assert.equal(b.report.totals.teachersNeedingAttention, 0);
            assert.equal(r.summary.schoolsWithHandover, 2, "A (twice, under two timezones) has one; B has none");
        });
        it("each school is read on its own calendar date: the same schema gives a different answer under Lagos and UTC", async () => {
            const r = await reportAcrossSchools({ schools: refs(), pool, now: FIXED_NOW });
            const upcomingOnNinth = (id: string) => person(r.results.find(x => x.schoolId === id)!.report, "Boundary")!.outstandingSubjects.some(s => s.termId === W.tYesterday.id);
            assert.equal(upcomingOnNinth("A-lagos"), false, "it is already the 10th in Lagos: the term that began on the 9th is history");
            assert.equal(upcomingOnNinth("A-utc"), true, "it is still the 9th in UTC: that term starts today");
        });
        it("reading changes nothing in any school", async () => {
            const before = await counts();
            await reportAcrossSchools({ schools: refs(), pool, now: FIXED_NOW });
            assert.deepEqual(await counts(), before);
        });
        it("an empty list of schools is a valid, empty answer", async () => {
            const r = await reportAcrossSchools({ schools: [], pool, now: FIXED_NOW });
            assert.deepEqual(r.summary, { schoolsRead: 0, schoolsWithHandover: 0, schoolsSkipped: 0, schoolsFailed: 0, teachers: 0, classesLed: 0, outstandingSubjects: 0, defaultsToUpdate: 0, completedSubjects: 0 });
        });
        it("the console report says what an administrator needs: who, what, which term, which sheet state, and what needs no action", async () => {
            const r = await reportAcrossSchools({ schools: refs(), pool, now: FIXED_NOW });
            const text = formatSchoolResult(r.results.find(x => x.schoolId === "A-lagos")!).join("\n");
            for (const needle of ["Leader Edge", "leads Edge A", "teaches Stat-draft in JSS 2A", "sheet: not started", "sheet: approved", "finished: Stat-locked", "upcoming", "history, untouched"]) assert.ok(text.includes(needle), `missing: ${needle}`);
        });
    });
});
