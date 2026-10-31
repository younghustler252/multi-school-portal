import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerateReportCardsUseCase } from "../../src/modules/report-cards/usecases/generate-report-cards.usecase";
import { admin, classTeacher, access, fakeRepo, worldWith, pub, auditLog } from "./helpers";

const NOW = new Date("2026-10-05T09:00:00Z");
const twoSheets = () => worldWith(
    [{ id: "m", name: "Maths", sheet: pub("sm") }, { id: "e", name: "English", sheet: pub("se") }, { id: "s", name: "Science", sheet: null }],
    { sm: { a: [30, 50], b: [20, 40], c: [10, 20] }, se: { a: [35, 45], b: [30, 30], c: [10, 15] } },
);
function build(world = twoSheets(), cards: any[] = []) {
    const { repo, rows, builder } = fakeRepo(world, cards); const a = auditLog();
    return { uc: new GenerateReportCardsUseCase({ reportCardsRepository: repo, reportCardBuilder: builder, auditService: a.svc }), rows, audit: a.entries };
}

test("builds a draft for everyone on the list, with the real class position, and audits it", async () => {
    const { uc, rows, audit } = build();
    const r = await uc.execute({ classId: "c1" }, "sch", admin(), { userId: "u1" }, NOW);
    assert.equal(r.created, 3); assert.equal(r.updated, 0); assert.deepEqual(r.skipped, []);
    assert.deepEqual(r.subjects, { published: 2, total: 3, missing: ["Science"] });
    const by = Object.fromEntries(rows.map(x => [x.studentId, x]));
    assert.deepEqual(["a", "b", "c"].map(i => by[i].position), [1, 2, 3]);
    assert.equal(by.a.averageScore, 80); assert.equal(by.a.totalScore, 160); assert.equal(by.a.totalStudents, 3);
    assert.equal(by.a.status, "draft"); assert.equal(by.a.generatedById, "u1");
    const snap: any = by.a.snapshot;
    assert.equal(snap.result.missing[0].subjectName, "Science");
    assert.deepEqual(snap.attendance, { marked: 3, present: 2, absent: 1, late: 0, excused: 0 });
    assert.equal(audit[0].action, "report_cards.generated"); assert.equal(audit[0].newValue.created, 3);
});

test("one student's card is ranked against the whole class, not just against itself", async () => {
    const { uc, rows } = build();
    await uc.execute({ classId: "c1", studentIds: ["c"] }, "sch", admin(), { userId: "u1" }, NOW);
    assert.equal(rows.length, 1); assert.equal(rows[0].position, 3); assert.equal(rows[0].totalStudents, 3);
});

test("rebuilding a draft keeps its remarks; published cards are never touched; strangers are skipped", async () => {
    const { uc, rows } = build(undefined, [
        { id: "k1", studentId: "a", termId: "term1", status: "draft", teacherRemark: "Good", principalRemark: "Keep going" },
        { id: "k2", studentId: "b", termId: "term1", status: "published", teacherRemark: "x", position: 9 },
    ]);
    const r = await uc.execute({ classId: "c1", studentIds: ["a", "b", "zzz"] }, "sch", admin(), { userId: "u1" }, NOW);
    assert.equal(r.updated, 1); assert.equal(r.created, 0);
    assert.deepEqual(r.skipped.sort((x, y) => x.studentId.localeCompare(y.studentId)), [{ studentId: "b", reason: "already_published" }, { studentId: "zzz", reason: "not_on_class_list" }]);
    const a = rows.find(x => x.id === "k1")!; assert.equal(a.teacherRemark, "Good"); assert.equal(a.principalRemark, "Keep going"); assert.equal(a.position, 1);
    assert.equal(rows.find(x => x.id === "k2")!.position, 9);
});

test("nothing published yet is a clear refusal, and nothing is written", async () => {
    const { uc, rows } = build(worldWith([{ id: "m", name: "Maths", sheet: { id: "sm", status: "approved", publishedAt: new Date() } }], { sm: { a: [1, 1] } }));
    await assert.rejects(uc.execute({ classId: "c1" }, "sch", admin(), { userId: "u1" }, NOW), (e: any) => e.code === "REPORT_CARDS_NOTHING_PUBLISHED");
    assert.equal(rows.length, 0);
});

test("locked sheets count as published; submitted and draft sheets never do", async () => {
    const w = worldWith([{ id: "m", name: "Maths", sheet: pub("sm", "locked") }, { id: "e", name: "English", sheet: pub("se", "submitted") }], { sm: { a: [30, 30] }, se: { a: [99, 1] } });
    const { uc, rows } = build(w);
    await uc.execute({ classId: "c1", studentIds: ["a"] }, "sch", admin(), { userId: "u1" }, NOW);
    assert.equal(rows[0].totalScore, 60);
});

test("only an administrator or the class teacher of THIS class may build", async () => {
    const ok = build(); await ok.uc.execute({ classId: "c1" }, "sch", classTeacher("t1"), { userId: "u1" }, NOW);
    assert.equal(ok.rows.length, 3);
    const other = build();
    await assert.rejects(other.uc.execute({ classId: "c1" }, "sch", classTeacher("t9"), { userId: "u1" }, NOW), /class teacher/);
    const noPerm = build();
    await assert.rejects(noPerm.uc.execute({ classId: "c1" }, "sch", access({ can: ["report_cards.view"] }), { userId: "u1" }, NOW), /class teacher/);
    const bad = build();
    await assert.rejects(bad.uc.execute({ classId: "nope" }, "sch", admin(), { userId: "u1" }, NOW), /not found/i);
});
