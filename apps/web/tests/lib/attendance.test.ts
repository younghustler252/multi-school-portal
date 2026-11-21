import { describe, expect, it } from "vitest";
import { mergeTeachingClasses, attendanceErrorMessage, entriesToSend, formatRate, presentForUnmarked, registerClosedReason, statusShown, submitSummary, todayInLagos } from "@/features/attendance/lib/attendance";
import type { ClassRegister, RegisterRow } from "@/features/attendance/types/attendance.types";

const row = (id: string, o: Partial<RegisterRow> = {}): RegisterRow => ({
	student: { id, name: id, admissionNumber: null }, id: null, status: null, note: null, markedBy: null, markedAt: null, editable: true, ...o,
});
const register = (students: RegisterRow[], o: Partial<ClassRegister> = {}): ClassRegister => ({
	class: { id: "c", name: "JSS1" }, date: "2026-11-05", term: { id: "t", name: "T1", session: null }, holiday: null, canMark: true, students,
	summary: { present: 0, absent: 0, late: 0, excused: 0, unmarked: students.length }, ...o,
});

describe("todayInLagos", () => {
	it("uses the Lagos calendar day, not UTC", () => {
		expect(todayInLagos(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06"); // 00:30 in Lagos (UTC+1)
		expect(todayInLagos(new Date("2026-11-05T10:00:00Z"))).toBe("2026-11-05");
	});
});

describe("presentForUnmarked", () => {
	it("marks unmarked editable lines only and keeps what the teacher already chose", () => {
		const r = register([row("a"), row("b", { status: "absent", id: "m1" }), row("c", { editable: false }), row("d")]);
		const next = presentForUnmarked(r, { d: { status: "late" } });
		expect(next).toEqual({ a: { status: "present" }, d: { status: "late" } });
	});
});

describe("entriesToSend", () => {
	const r = register([row("a"), row("b", { status: "present", id: "m1", note: "x" }), row("c", { status: "absent", id: "m2", editable: false }), row("d")]);
	it("sends nothing when nothing changed", () => expect(entriesToSend(r, {})).toEqual([]));
	it("sends new marks and real changes, skips same status and locked lines", () => {
		const out = entriesToSend(r, { a: { status: "late" }, b: { status: "present" }, c: { status: "present" }, d: {} });
		expect(out).toEqual([{ studentId: "a", status: "late" }]);
	});
	it("sends a status change", () => expect(entriesToSend(r, { b: { status: "excused" } })).toEqual([{ studentId: "b", status: "excused" }]));
	it("sends a note change with the saved status, and clears a blank note with null", () => {
		expect(entriesToSend(r, { b: { note: " sick " } })).toEqual([{ studentId: "b", status: "present", note: "sick" }]);
		expect(entriesToSend(r, { b: { note: "  " } })).toEqual([{ studentId: "b", status: "present", note: null }]);
	});
	it("ignores a note on an unmarked line (a note needs a status)", () => expect(entriesToSend(r, { a: { note: "hi" } })).toEqual([]));
});

describe("statusShown", () => {
	it("prefers the teacher's choice over the saved status", () => {
		expect(statusShown(row("a", { status: "present" }), { a: { status: "late" } })).toBe("late");
		expect(statusShown(row("a", { status: "present" }), {})).toBe("present");
		expect(statusShown(row("a"), {})).toBeNull();
	});
});

describe("registerClosedReason", () => {
	it("explains each closed state", () => {
		expect(registerClosedReason(register([]), "2026-11-05")).toBeNull();
		expect(registerClosedReason(register([], { canMark: false, holiday: "Independence Day" }), "2026-11-05")).toMatch(/Independence Day is a holiday/);
		expect(registerClosedReason(register([], { canMark: false, date: "2026-11-09" }), "2026-11-05")).toMatch(/future/);
		expect(registerClosedReason(register([], { canMark: false }), "2026-11-05")).toMatch(/view this register/);
	});
});

describe("messages", () => {
	it("summarises a saved register", () => {
		const base = { class: { id: "c", name: "x" }, date: "d", term: { id: "t", name: "T", session: null }, skipped: [], unmarked: 0 };
		expect(submitSummary({ ...base, created: 20, updated: 2, unchanged: 1 })).toBe("20 marked, 2 corrected, 1 unchanged");
		expect(submitSummary({ ...base, created: 0, updated: 0, unchanged: 0 })).toBe("Nothing to change");
	});
	it("formats rates, keeping null as a dash", () => {
		expect(formatRate(92.5)).toBe("92.5%");
		expect(formatRate(null)).toBe("—");
	});
	it("explains domain codes with a fallback", () => {
		expect(attendanceErrorMessage("ATTENDANCE_HOLIDAY", "x")).toMatch(/holiday/);
		expect(attendanceErrorMessage("ATTENDANCE_TERM_AMBIGUOUS", "x")).toMatch(/administrator/);
		expect(attendanceErrorMessage("OTHER", "server")).toBe("server");
	});
});

describe("mergeTeachingClasses", () => {
	it("lists led and taught classes, each once, led first", () => {
		const led = [{ classId: "a", className: "JSS1" }];
		const taught = [{ classId: "b", className: "JSS2" }, { classId: "a", className: "JSS1" }];
		expect(mergeTeachingClasses(led, taught)).toEqual([{ id: "a", name: "JSS1" }, { id: "b", name: "JSS2" }]);
	});
	it("handles missing lists", () => {
		expect(mergeTeachingClasses(undefined, undefined)).toEqual([]);
		expect(mergeTeachingClasses(undefined, [{ classId: "b", className: "JSS2" }])).toEqual([{ id: "b", name: "JSS2" }]);
	});
});
