import { test } from "node:test";
import assert from "node:assert/strict";
import {
    buildClassResults, fingerprintOf, staleness, publishBlockers, nextCardStatus, isVisibleCard, isEditableCard, summariseAttendance,
    PublishedSheet, CardSnapshot,
} from "../../src/modules/report-cards/domain/report-card.policy";

const parts = [{ position: 1, name: "CA", kind: "ca" as const, maxScore: 40 }, { position: 2, name: "Exam", kind: "exam" as const, maxScore: 60 }];
const scale = [{ minScore: 0, grade: "F", remark: "Fail", isPass: false }, { minScore: 40, grade: "C", remark: "Credit", isPass: true }, { minScore: 70, grade: "A", remark: "Excellent", isPass: true }];

function sheet(id: string, name: string, rows: Record<string, [number | null, number | null, boolean?]>, publishedAt = "2026-10-01T10:00:00Z"): PublishedSheet {
    const grades = new Map<string, any>();
    for (const [sid, [ca, ex, abs]] of Object.entries(rows)) {
        const total = ca === null || ex === null ? null : ca + ex;
        grades.set(sid, { scores: [{ position: 1, score: ca, isAbsent: false }, { position: 2, score: ex, isAbsent: !!abs }], total, grade: total === null ? null : total >= 70 ? "A" : total >= 40 ? "C" : "F", remark: "x", position: 1, outOf: 3 });
    }
    return { classSubjectId: id, subjectName: name, teacher: "Mr T", parts, scale, publishedAt, grades };
}
const subjects = [{ classSubjectId: "m", subjectName: "Maths" }, { classSubjectId: "e", subjectName: "English" }, { classSubjectId: "s", subjectName: "Science" }];

test("totals, average and subjects are built from published sheets only; the unpublished one is missing, not zero", () => {
    const r = buildClassResults({
        studentIds: ["a"], allSubjects: subjects, bands: scale,
        sheets: [sheet("m", "Maths", { a: [30, 50] }), sheet("e", "English", { a: [20, 40] })],
    }).get("a")!;
    assert.equal(r.totalScore, 140);
    assert.equal(r.averageScore, 70);
    assert.equal(r.subjectsCounted, 2);
    assert.deepEqual(r.missing.map(m => m.subjectName), ["Science"]);
    assert.deepEqual(r.subjects.map(s => s.subjectName), ["English", "Maths"]);   // alphabetical
    assert.equal(r.overallGrade?.grade, "A");
    assert.equal(r.subjects[1].ca, 30); assert.equal(r.subjects[1].exam, 50);
});

test("overall position ranks the whole class by average; ties share a position", () => {
    const r = buildClassResults({
        studentIds: ["a", "b", "c", "d"], allSubjects: subjects.slice(0, 1), bands: scale,
        sheets: [sheet("m", "Maths", { a: [40, 40], b: [40, 40], c: [20, 30], d: [10, 10] })],
    });
    assert.deepEqual(["a", "b", "c", "d"].map(i => r.get(i)!.position), [1, 1, 3, 4]);
    assert.equal(r.get("a")!.outOf, 4);
});

test("a student with no total is not ranked and the others are not affected", () => {
    const r = buildClassResults({
        studentIds: ["a", "b"], allSubjects: subjects.slice(0, 1), bands: scale,
        sheets: [sheet("m", "Maths", { a: [30, 30], b: [null, null] })],
    });
    assert.equal(r.get("b")!.position, null);
    assert.equal(r.get("b")!.averageScore, null);
    assert.equal(r.get("a")!.position, 1);
    assert.equal(r.get("a")!.outOf, 1);
});

test("an absent part counts 0 and is flagged; isPass comes from the sheet's frozen scale", () => {
    const r = buildClassResults({
        studentIds: ["a"], allSubjects: subjects.slice(0, 1), bands: scale,
        sheets: [sheet("m", "Maths", { a: [35, 0, true] })],
    }).get("a")!;
    assert.equal(r.subjects[0].parts[1].absent, true);
    assert.equal(r.subjects[0].parts[1].score, 0);
    assert.equal(r.subjects[0].total, 35);
    assert.equal(r.subjects[0].isPass, false);
});

test("a student who is not on a published sheet gets no invented row", () => {
    const r = buildClassResults({ studentIds: ["a", "z"], allSubjects: subjects.slice(0, 1), bands: scale, sheets: [sheet("m", "Maths", { a: [30, 30] })] }).get("z")!;
    assert.equal(r.subjects.length, 0); assert.equal(r.averageScore, null); assert.equal(r.position, null);
});

test("fingerprints notice a new subject, a reopened sheet and a republished sheet", () => {
    const base = fingerprintOf([{ classSubjectId: "m", publishedAt: "2026-10-01T10:00:00Z" }, { classSubjectId: "e", publishedAt: "2026-10-01T11:00:00Z" }]);
    const snap = { fingerprint: base } as CardSnapshot;
    assert.equal(staleness(snap, [...base].reverse().sort()).stale, false);
    const more = fingerprintOf([{ classSubjectId: "m", publishedAt: "2026-10-01T10:00:00Z" }, { classSubjectId: "e", publishedAt: "2026-10-01T11:00:00Z" }, { classSubjectId: "s", publishedAt: "2026-10-02T09:00:00Z" }]);
    assert.match(staleness(snap, more).reason!, /More subjects/);
    const fewer = fingerprintOf([{ classSubjectId: "m", publishedAt: "2026-10-01T10:00:00Z" }]);
    assert.match(staleness(snap, fewer).reason!, /reopened/);
    const again = fingerprintOf([{ classSubjectId: "m", publishedAt: "2026-10-05T10:00:00Z" }, { classSubjectId: "e", publishedAt: "2026-10-01T11:00:00Z" }]);
    assert.match(staleness(snap, again).reason!, /published again/);
    assert.deepEqual(staleness(null, base), { stale: false, reason: null });
});

test("publishing is blocked when nothing is scored, or subjects are missing unless the school allows it", () => {
    const snap = (missing: number, counted: number) => ({ result: { subjectsCounted: counted, missing: Array.from({ length: missing }, (_, i) => ({ classSubjectId: String(i), subjectName: `S${i}` })) } }) as CardSnapshot;
    assert.equal(publishBlockers(snap(0, 3), false).length, 0);
    assert.equal(publishBlockers(snap(0, 0), true).length, 1);
    assert.match(publishBlockers(snap(2, 1), false)[0], /S0, S1/);
    assert.equal(publishBlockers(snap(2, 1), true).length, 0);
});

test("card status moves: draft -> published -> sent; unpublish returns to draft; nothing else", () => {
    assert.equal(nextCardStatus("publish", "draft"), "published");
    assert.equal(nextCardStatus("publish", "published"), null);
    assert.equal(nextCardStatus("mark_sent", "published"), "sent");
    assert.equal(nextCardStatus("mark_sent", "draft"), null);
    assert.equal(nextCardStatus("unpublish", "sent"), "draft");
    assert.equal(nextCardStatus("unpublish", "draft"), null);
    assert.equal(isVisibleCard("sent") && isVisibleCard("published") && !isVisibleCard("draft"), true);
    assert.equal(isEditableCard("draft") && !isEditableCard("published"), true);
});

test("attendance summary counts each status and ignores unknown ones", () => {
    assert.deepEqual(summariseAttendance([{ status: "present" }, { status: "present" }, { status: "absent" }, { status: "late" }, { status: "excused" }, { status: "weird" }]),
        { marked: 6, present: 2, absent: 1, late: 1, excused: 1 });
});
