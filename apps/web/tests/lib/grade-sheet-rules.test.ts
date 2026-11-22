import { describe, it, expect } from "vitest";
import {
	availableActions, buildScoreEntries, chunkEntries, gradesErrorText, incompleteStudents, missingParts, progressText,
	reopenReasonProblem, scoreProblem, skipText,
} from "@/features/grades/lib/sheet-rules";
import type { SheetPart, SheetStudentRow } from "@/features/grades/types/sheet-contract.types";

const parts: SheetPart[] = [
	{ position: 1, name: "CA 1", kind: "ca", maxScore: 20 },
	{ position: 2, name: "Exam", kind: "exam", maxScore: 60 },
];
const row = (id: string, scores: SheetStudentRow["scores"]): SheetStudentRow => ({
	student: { id, name: `S ${id}`, admissionNumber: null }, scores, total: null, grade: null, remark: null, position: null,
});
const sheet = {
	parts,
	students: [
		row("a", [{ position: 1, score: 15, absent: false }, { position: 2, score: null, absent: true }]),
		row("b", [{ position: 1, score: 10, absent: false }, { position: 2, score: null, absent: false }]),
	],
};

describe("sheet rules", () => {
	it("offers only what the server allows, in workflow order", () => {
		expect(availableActions({ enter: true, submit: true, approve: false, publish: false, lock: false, reopen: false })).toEqual(["submit"]);
		expect(availableActions({ enter: false, submit: false, approve: true, publish: true, lock: false, reopen: true })).toEqual(["approve", "publish", "reopen"]);
		expect(availableActions({ enter: false, submit: false, approve: false, publish: false, lock: false, reopen: false })).toEqual([]);
	});
	it("treats absent as complete and a blank as missing", () => {
		expect(missingParts(parts, sheet.students[0])).toEqual([]);
		expect(missingParts(parts, sheet.students[1])).toEqual(["Exam"]);
		expect(incompleteStudents(sheet)).toEqual([{ studentId: "b", name: "S b", missing: ["Exam"] }]);
	});
	it("describes progress", () => {
		expect(progressText({ students: 0, complete: 0 })).toBe("No students on this class list");
		expect(progressText({ students: 30, complete: 12 })).toBe("12 of 30 complete");
	});
	it("checks a typed score", () => {
		expect(scoreProblem(parts[0], "")).toBe(null);
		expect(scoreProblem(parts[0], "20")).toBe(null);
		expect(scoreProblem(parts[0], "12.25")).toBe(null);
		expect(scoreProblem(parts[0], "21")).toMatch(/more than 20/);
		expect(scoreProblem(parts[0], "-1")).toMatch(/number/);
		expect(scoreProblem(parts[0], "1.234")).toMatch(/2 decimals/);
		expect(scoreProblem(parts[0], "abc")).toMatch(/number/);
	});
	it("builds only changed cells; blank clears; absent has no score", () => {
		const r = buildScoreEntries(sheet, [
			{ studentId: "a", position: 1, raw: "15", absent: false }, // unchanged
			{ studentId: "a", position: 2, raw: "", absent: true },    // unchanged (already absent)
			{ studentId: "b", position: 1, raw: "", absent: false },   // clear
			{ studentId: "b", position: 2, raw: "44.5", absent: false },
		]);
		expect(r.problems).toEqual([]);
		expect(r.entries).toEqual([{ studentId: "b", scores: [{ position: 1 }, { position: 2, score: 44.5 }] }]);
		const abs = buildScoreEntries(sheet, [{ studentId: "b", position: 2, raw: "30", absent: true }]);
		expect(abs.entries).toEqual([{ studentId: "b", scores: [{ position: 2, absent: true }] }]);
	});
	it("reports invalid text and does not send it", () => {
		const r = buildScoreEntries(sheet, [{ studentId: "b", position: 2, raw: "99", absent: false }]);
		expect(r.entries).toEqual([]);
		expect(r.problems.length).toBe(1);
		expect(r.problems[0]).toMatch(/S b: Exam: cannot be more than 60/);
	});
	it("splits large saves at the server limit", () => {
		const list = Array.from({ length: 450 }, (_, i) => i);
		expect(chunkEntries(list).map((c) => c.length)).toEqual([200, 200, 50]);
		expect(chunkEntries([])).toEqual([]);
	});
	it("words skipped entries", () => {
		expect(skipText({ student: { id: "a", name: "Ada", admissionNumber: null }, studentId: "a", reason: "duplicate_entry" })).toBe("Ada was listed twice");
		expect(skipText({ student: null, studentId: "x", reason: "not_on_class_list" })).toBe("A student is not on this class list");
		expect(skipText({ student: { id: "a", name: "Ada", admissionNumber: null }, studentId: "a", reason: "invalid_score", message: "Exam: too high" })).toBe("Ada: Exam: too high");
	});
	it("checks the reopen reason", () => {
		expect(reopenReasonProblem("no")).toMatch(/at least 5/);
		expect(reopenReasonProblem("  ok  ")).toMatch(/at least 5/);
		expect(reopenReasonProblem("Wrong exam marks")).toBe(null);
		expect(reopenReasonProblem("x".repeat(501))).toMatch(/under 500/);
	});
	it("maps grades error codes", () => {
		expect(gradesErrorText("GRADES_SHEET_NOT_EDITABLE", { status: "published" })).toMatch(/published/);
		expect(gradesErrorText("GRADES_SHEET_INCOMPLETE", { total: 3 })).toMatch(/^3 student/);
		expect(gradesErrorText("GRADES_SCHEME_INVALID", { problems: ["Total must be 100"] })).toMatch(/Total must be 100/);
		expect(gradesErrorText("SOMETHING_ELSE")).toBe(null);
		expect(gradesErrorText(undefined)).toBe(null);
	});
});
