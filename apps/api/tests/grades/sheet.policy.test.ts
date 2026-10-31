import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextStatus, canEditScores, reopenPermission, isVisibleToFamilies, problemWithScore, mergeScores, isComplete, totalOf, sumByKind, rankPositions, SheetPart, SHEET_STATUSES } from "../../src/modules/grades/domain/sheet.policy";

const parts: SheetPart[] = [{ position: 1, name: "CA1", kind: "ca", maxScore: 10 }, { position: 2, name: "CA2", kind: "ca", maxScore: 30 }, { position: 3, name: "Exam", kind: "exam", maxScore: 60 }];

describe("workflow", () => {
    it("moves one step at a time, in order", () => {
        assert.equal(nextStatus("submit", "draft"), "submitted");
        assert.equal(nextStatus("approve", "submitted"), "approved");
        assert.equal(nextStatus("publish", "approved"), "published");
        assert.equal(nextStatus("lock", "published"), "locked");
    });
    it("nothing can be skipped or repeated", () => {
        assert.equal(nextStatus("publish", "draft"), null);
        assert.equal(nextStatus("publish", "submitted"), null, "approval is required");
        assert.equal(nextStatus("approve", "draft"), null);
        assert.equal(nextStatus("submit", "submitted"), null);
        assert.equal(nextStatus("lock", "approved"), null);
        assert.equal(nextStatus("publish", "published"), null);
    });
    it("a school that does not require approval may publish straight after submit", () => assert.equal(nextStatus("publish", "submitted", false), "published"));
    it("reopen goes back to draft from every other state, never from draft", () => {
        for (const s of SHEET_STATUSES) assert.equal(nextStatus("reopen", s), s === "draft" ? null : "draft", s);
    });
    it("only a draft can be edited; only published sheets are visible to families; who may reopen depends on how far it got", () => {
        assert.deepEqual(SHEET_STATUSES.map(canEditScores), [true, false, false, false, false]);
        assert.deepEqual(SHEET_STATUSES.map(isVisibleToFamilies), [false, false, false, true, true]);
        assert.deepEqual(SHEET_STATUSES.map(reopenPermission), ["grades.reopen", "grades.approve", "grades.approve", "grades.reopen", "grades.reopen"]);
    });
});

describe("scores", () => {
    it("each score is within its part's maximum, from 0, with at most 2 decimals; absent has no score", () => {
        assert.equal(problemWithScore(parts, { position: 1, score: 10 }), null);
        assert.equal(problemWithScore(parts, { position: 3, score: 59.5 }), null);
        assert.match(problemWithScore(parts, { position: 1, score: 10.5 })!, /cannot be more than 10/);
        assert.match(problemWithScore(parts, { position: 1, score: -1 })!, /from 0/);
        assert.match(problemWithScore(parts, { position: 1, score: 7.123 })!, /2 decimals/);
        assert.match(problemWithScore(parts, { position: 9, score: 1 })!, /no part number 9/);
        assert.match(problemWithScore(parts, { position: 3, score: 5, absent: true })!, /absent cannot also have a score/);
        assert.equal(problemWithScore(parts, { position: 3, absent: true }), null);
    });
    it("new entries go over saved ones; an empty entry clears a part back to 'not entered'", () => {
        const saved = [{ position: 1, score: 8, isAbsent: false }, { position: 3, score: 40, isAbsent: false }];
        assert.deepEqual(mergeScores(saved, [{ position: 3, score: 45 }, { position: 2, score: 20 }]), [{ position: 1, score: 8, isAbsent: false }, { position: 2, score: 20, isAbsent: false }, { position: 3, score: 45, isAbsent: false }]);
        assert.deepEqual(mergeScores(saved, [{ position: 1, score: null }]), [{ position: 3, score: 40, isAbsent: false }]);
        assert.deepEqual(mergeScores(saved, [{ position: 3, absent: true }]).find(s => s.position === 3), { position: 3, score: null, isAbsent: true });
    });
    it("a total needs every part; absent counts as 0; a missing part is NOT 0", () => {
        const full = [{ position: 1, score: 8, isAbsent: false }, { position: 2, score: 25, isAbsent: false }, { position: 3, score: 50, isAbsent: false }];
        assert.equal(totalOf(parts, full), 83);
        assert.equal(totalOf(parts, full.slice(0, 2)), null, "exam not entered: no total, never a made-up 0");
        assert.equal(isComplete(parts, full.slice(0, 2)), false);
        assert.equal(totalOf(parts, [...full.slice(0, 2), { position: 3, score: null, isAbsent: true }]), 33);
        assert.equal(totalOf(parts, [{ position: 1, score: 0.1, isAbsent: false }, { position: 2, score: 0.2, isAbsent: false }, { position: 3, score: 0, isAbsent: false }]), 0.3, "no floating point noise");
    });
    it("the CA and exam totals (for the older columns) are summed by kind; none entered is null", () => {
        const s = [{ position: 1, score: 8, isAbsent: false }, { position: 2, score: 25, isAbsent: false }];
        assert.deepEqual([sumByKind(parts, s, "ca"), sumByKind(parts, s, "exam")], [33, null]);
    });
});

describe("positions", () => {
    const pos = (rows: Array<[string, number | null]>) => { const r = rankPositions(rows.map(([studentId, total]) => ({ studentId, total }))); return { p: Object.fromEntries([...r.positions].map(([k, v]) => [k, v.position])), n: r.ranked }; };
    it("ties share a position and the next one skips (80, 80, 70 is 1st, 1st, 3rd)", () => {
        assert.deepEqual(pos([["a", 80], ["b", 70], ["c", 80]]), { p: { a: 1, b: 3, c: 1 }, n: 3 });
    });
    it("students with no total are not ranked and not counted", () => {
        assert.deepEqual(pos([["a", 60], ["b", null], ["c", 75.5]]), { p: { a: 2, b: null, c: 1 }, n: 2 });
        assert.deepEqual(pos([["a", null]]), { p: { a: null }, n: 0 });
    });
    it("a zero total is a real total and is ranked last, not skipped", () => assert.deepEqual(pos([["a", 0], ["b", 10]]), { p: { a: 2, b: 1 }, n: 2 }));
});
