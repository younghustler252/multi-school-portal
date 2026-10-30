import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSchoolDay, dayKey, todayKey, isFutureDay, termForDay, holidayOn, withinEditWindow, summarize, addDays } from "../../src/modules/attendance/domain/attendance.policy";
import { validatePermissionRegistry, PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { AttendanceSubmit } from "./dto-helper";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("school days", () => {
    it("only a real YYYY-MM-DD date is a day; times and fake dates are refused", () => {
        assert.deepEqual(parseSchoolDay("2026-10-26"), D("2026-10-26"));
        for (const bad of ["2026-10-26T15:00:00Z", "2026-02-30", "2026-13-01", "26-10-2026", "", "2026-1-5"]) assert.equal(parseSchoolDay(bad), null, bad);
    });
    it("a time on the same day is the SAME day (the old two-records-for-one-day bug)", () => {
        assert.equal(dayKey(new Date("2026-10-26T15:00:00Z")), dayKey(new Date("2026-10-26")));
    });
    it("'today' is the school's date (Lagos), not the server's: 23:30 UTC is already tomorrow in Lagos", () => {
        assert.equal(todayKey(new Date("2026-10-26T23:30:00Z")), "2026-10-27");
        assert.equal(isFutureDay("2026-10-27", new Date("2026-10-26T12:00:00Z")), true);
        assert.equal(isFutureDay("2026-10-26", new Date("2026-10-26T12:00:00Z")), false);
    });
});

describe("which term a day is in", () => {
    const t1 = { id: "t1", startDate: D("2026-09-07"), endDate: D("2026-12-11") };
    const t2 = { id: "t2", startDate: D("2027-01-11"), endDate: D("2027-04-02") };
    it("both end dates count; the gap between terms is outside every term", () => {
        assert.deepEqual(termForDay([t1, t2], "2026-09-07"), { kind: "found", term: t1 });
        assert.deepEqual(termForDay([t1, t2], "2026-12-11"), { kind: "found", term: t1 });
        assert.deepEqual(termForDay([t1, t2], "2026-12-25"), { kind: "none" });
    });
    it("a term whose dates carry a clock time still matches by date", () => {
        const odd = { id: "x", startDate: new Date("2026-09-07T09:00:00Z"), endDate: new Date("2026-12-11T23:00:00Z") };
        assert.equal(termForDay([odd], "2026-09-07").kind, "found");
        assert.equal(termForDay([odd], "2026-12-11").kind, "found");
    });
    it("overlapping terms are never guessed", () => {
        const r = termForDay([t1, { ...t2, startDate: D("2026-11-01"), endDate: D("2027-02-01") }], "2026-11-15");
        assert.deepEqual(r, { kind: "ambiguous", ids: ["t1", "t2"] });
    });
});

describe("calendar holidays", () => {
    const one = { title: "Independence Day", isHoliday: true, startDate: D("2026-10-01"), endDate: null };
    const range = { title: "Mid-term break", isHoliday: true, startDate: D("2026-10-26"), endDate: D("2026-10-30") };
    const sports = { title: "Sports day", isHoliday: false, startDate: D("2026-10-14"), endDate: null };
    it("a one-day holiday, a range (both ends), and a non-holiday event", () => {
        assert.equal(holidayOn([one, range, sports], "2026-10-01")?.title, "Independence Day");
        assert.equal(holidayOn([one, range, sports], "2026-10-26")?.title, "Mid-term break");
        assert.equal(holidayOn([one, range, sports], "2026-10-30")?.title, "Mid-term break");
        assert.equal(holidayOn([one, range, sports], "2026-10-31"), undefined);
        assert.equal(holidayOn([one, range, sports], "2026-10-14"), undefined, "an event that is not a holiday does not close the register");
    });
});

describe("edit window (48 hours from when the mark was first made)", () => {
    const made = new Date("2026-10-26T08:00:00Z");
    it("open at 47h59, closed after 48h", () => {
        assert.equal(withinEditWindow(made, new Date("2026-10-28T07:59:00Z")), true);
        assert.equal(withinEditWindow(made, new Date("2026-10-28T08:00:00Z")), true);
        assert.equal(withinEditWindow(made, new Date("2026-10-28T08:01:00Z")), false);
    });
});

describe("attendance rate", () => {
    it("(present + late) / (present + late + absent); excused is shown but not in the rate", () => {
        const s = summarize({ present: 14, late: 2, absent: 4, excused: 3 });
        assert.equal(s.rate, 80);                 // 16 / 20
        assert.equal(s.timesPresent, 16);
        assert.equal(s.daysMarked, 23);           // every day with a mark, excused included
        assert.equal(s.excused, 3);
        assert.equal(s.lowAttendance, false);
    });
    it("no counted days -> no rate (never 0% or 100% by accident); below 75% is flagged low", () => {
        assert.equal(summarize({ excused: 5 }).rate, null);
        assert.equal(summarize({}).rate, null);
        assert.equal(summarize({}).lowAttendance, false);
        const low = summarize({ present: 7, absent: 3 });
        assert.equal(low.rate, 70); assert.equal(low.lowAttendance, true);
        assert.equal(summarize({ present: 1, absent: 2 }).rate, 33.3);
    });
});

describe("attendance permissions and default roles", () => {
    const has = (role: string, key: string, scope: string) => ROLE_TEMPLATES.find(t => t.key === role)!.permissions.some(p => p.key === key && p.scope === scope);
    it("the registry is valid and has view, mark and override (override is sensitive)", () => {
        assert.deepEqual(validatePermissionRegistry(PERMISSION_REGISTRY), []);
        const keys = PERMISSION_REGISTRY.filter(p => p.module === "attendance").map(p => p.key).sort();
        assert.deepEqual(keys, ["attendance.mark", "attendance.override", "attendance.view"]);
        assert.equal((PERMISSION_REGISTRY.find(p => p.key === "attendance.override") as any).isSensitive, true);
    });
    it("principal sees all; teacher sees and marks their classes; student and guardian see their own; nobody but the admin overrides", () => {
        assert.equal(has("principal", "attendance.view", "ALL"), true);
        assert.equal(has("teacher", "attendance.view", "ASSIGNED"), true);
        assert.equal(has("teacher", "attendance.mark", "ASSIGNED"), true);
        assert.equal(has("student", "attendance.view", "OWN"), true);
        assert.equal(has("guardian", "attendance.view", "OWN"), true);
        assert.equal(ROLE_TEMPLATES.some(t => t.permissions.some(p => p.key === "attendance.override")), false);
        assert.equal(ROLE_TEMPLATES.some(t => t.key !== "school_admin" && t.permissions.some(p => p.key === "attendance.mark" && p.scope === "ALL")), false);
    });
});

describe("register request", () => {
    it("a day without a time, 1 to 200 students, a known status, no extra fields; an empty note becomes none", () => {
        const ok = { date: "2026-10-26", entries: [{ studentId: "11111111-1111-4111-8111-111111111111", status: "present" }] };
        assert.equal(AttendanceSubmit.safeParse(ok).success, true);
        assert.equal(AttendanceSubmit.safeParse({ ...ok, date: "2026-10-26T15:00:00Z" }).success, false);
        assert.equal(AttendanceSubmit.safeParse({ ...ok, entries: [] }).success, false);
        assert.equal(AttendanceSubmit.safeParse({ ...ok, termId: "x" }).success, false, "the browser never sends the term");
        assert.equal(AttendanceSubmit.safeParse({ date: ok.date, entries: [{ ...ok.entries[0], status: "sick" }] }).success, false);
        const n = AttendanceSubmit.parse({ date: ok.date, entries: [{ ...ok.entries[0], note: "  " }] });
        assert.equal(n.entries[0].note, null);
    });
    it("addDays moves by whole days", () => assert.equal(dayKey(addDays(D("2026-10-31"), 1)), "2026-11-01"));
});
