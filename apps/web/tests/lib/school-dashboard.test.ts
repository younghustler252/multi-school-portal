import { describe, expect, it } from "vitest";
import {
	attendanceScopeLabel, attendanceView, feesView, formatSchoolDay, hasNothingToShow, planExpiryView, usageView,
} from "@/lib/school-dashboard";
import type { SchoolDashboardData } from "@/features/school/types/school.types";

describe("attendanceView", () => {
	const day = "2026-11-21";

	it("is (present + late) / (present + late + absent)", () => {
		const v = attendanceView({ date: day, present: 80, late: 10, absent: 10, excused: 0 });
		expect(v.attended).toBe(90);
		expect(v.counted).toBe(100);
		expect(v.ratePercent).toBe(90);
	});

	it("leaves excused out of the denominator", () => {
		// 80 present, 10 late, 5 absent, 20 excused: 90 / 95, not 90 / 115.
		const v = attendanceView({ date: day, present: 80, late: 10, absent: 5, excused: 20 });
		expect(v.counted).toBe(95);
		expect(v.ratePercent).toBe(95);
	});

	it("does not let excused change the rate at all", () => {
		const without = attendanceView({ date: day, present: 8, late: 1, absent: 1, excused: 0 });
		const withExcused = attendanceView({ date: day, present: 8, late: 1, absent: 1, excused: 50 });
		expect(withExcused.ratePercent).toBe(without.ratePercent);
	});

	it("keeps excused visible in the breakdown and in the marked total", () => {
		const v = attendanceView({ date: day, present: 1, late: 2, absent: 3, excused: 4 });
		expect(v.excused).toBe(4);
		expect(v.marked).toBe(10);
		expect(v.segments.map((s) => s.key)).toEqual(["present", "late", "absent", "excused"]);
		expect(v.segments.map((s) => s.count)).toEqual([1, 2, 3, 4]);
	});

	it("has no rate (not 0%) when nothing is marked", () => {
		const v = attendanceView({ date: day, present: 0, late: 0, absent: 0, excused: 0 });
		expect(v.ratePercent).toBeNull();
		expect(v.marked).toBe(0);
	});

	it("has no rate when everyone marked is excused, but still counts them as marked", () => {
		const v = attendanceView({ date: day, present: 0, late: 0, absent: 0, excused: 7 });
		expect(v.ratePercent).toBeNull();
		expect(v.marked).toBe(7);
	});

	it("is 0% (a real value) when only absences are marked", () => {
		expect(attendanceView({ date: day, present: 0, late: 0, absent: 3, excused: 0 }).ratePercent).toBe(0);
	});

	it("rounds to a whole percent", () => {
		expect(attendanceView({ date: day, present: 2, late: 0, absent: 1, excused: 0 }).ratePercent).toBe(67);
	});
});

describe("attendanceScopeLabel", () => {
	it("names each scope the API can send", () => {
		expect(attendanceScopeLabel("ALL")).toBe("Whole school");
		expect(attendanceScopeLabel("BRANCH")).toBe("Your branches");
		expect(attendanceScopeLabel("ASSIGNED")).toBe("Your classes");
		expect(attendanceScopeLabel("OWN")).toBe("Your own records");
	});

	it("says nothing when the scope is missing or unrecognised, rather than guessing", () => {
		expect(attendanceScopeLabel(undefined)).toBeNull();
		expect(attendanceScopeLabel("NONE")).toBeNull();
		expect(attendanceScopeLabel("SOMETHING_NEW")).toBeNull();
	});
});

describe("feesView", () => {
	it("is collected over invoiced", () => {
		const v = feesView({ term: "t", totalInvoicedKobo: 200_000, totalCollectedKobo: 50_000, totalPendingKobo: 150_000, overdueInvoices: 1 });
		expect(v.collectedPercent).toBe(25);
		expect(v.hasInvoices).toBe(true);
	});

	it("has no percentage when nothing is invoiced", () => {
		const v = feesView({ term: null, totalInvoicedKobo: 0, totalCollectedKobo: 0, totalPendingKobo: 0, overdueInvoices: 0 });
		expect(v.collectedPercent).toBeNull();
		expect(v.hasInvoices).toBe(false);
	});
});

describe("usageView", () => {
	it("treats a null limit as unlimited", () => {
		expect(usageView(500, null)).toEqual({ used: 500, limit: null, percent: null, state: "unlimited" });
	});

	it("is ok well under the limit", () => {
		expect(usageView(50, 100).state).toBe("ok");
		expect(usageView(50, 100).percent).toBe(50);
	});

	it("is near from 90% and full at the limit, capped at 100%", () => {
		expect(usageView(90, 100).state).toBe("near");
		expect(usageView(100, 100).state).toBe("full");
		expect(usageView(120, 100).percent).toBe(100);
		expect(usageView(120, 100).state).toBe("full");
	});

	it("has no room when the limit is 0", () => {
		expect(usageView(0, 0).state).toBe("full");
	});
});

describe("planExpiryView", () => {
	const now = new Date("2026-11-21T10:00:00Z");

	it("has nothing to say without an end date", () => {
		expect(planExpiryView(null, now)).toEqual({ state: "none", daysLeft: null });
	});

	it("is ok with more than 14 days left", () => {
		expect(planExpiryView("2027-01-21T10:00:00Z", now).state).toBe("ok");
	});

	it("is soon within 14 days", () => {
		const v = planExpiryView("2026-11-28T10:00:00Z", now);
		expect(v.state).toBe("soon");
		expect(v.daysLeft).toBe(7);
	});

	it("is expired once the end date has passed", () => {
		const v = planExpiryView("2026-11-10T10:00:00Z", now);
		expect(v.state).toBe("expired");
		expect(v.daysLeft).toBe(-11);
	});

	it("ignores an unreadable date", () => {
		expect(planExpiryView("not-a-date", now).state).toBe("none");
	});
});

describe("hasNothingToShow", () => {
	const base: SchoolDashboardData = {
		school: { name: "S", status: "active", verificationStatus: "verified" },
		plan: { name: "Free", status: "none", expiresAt: null, studentLimit: null, staffLimit: null },
		people: null, academics: null, fees: null, attendance: null,
	};
	const academics = { currentTerm: "2026/27 First Term", totalClasses: 5, totalSubjects: 9, activeEnrolments: 120 };

	it("is true when every section the page draws is null", () => {
		expect(hasNothingToShow(base)).toBe(true);
	});

	it("is still true when only academics arrived: the page draws no academics section", () => {
		expect(hasNothingToShow({ ...base, academics })).toBe(true);
	});

	it("is false when any drawn section arrived", () => {
		expect(hasNothingToShow({ ...base, attendance: { date: "2026-11-21", scope: "ALL", present: 0, late: 0, absent: 0, excused: 0 } })).toBe(false);
		expect(hasNothingToShow({ ...base, fees: { term: null, totalInvoicedKobo: 0, totalCollectedKobo: 0, totalPendingKobo: 0, overdueInvoices: 0 } })).toBe(false);
	});
});

describe("formatSchoolDay", () => {
	it("formats the calendar day without shifting it", () => {
		expect(formatSchoolDay("2026-11-21")).toBe("Sat 21 Nov");
	});

	it("returns the input when it is not a date", () => {
		expect(formatSchoolDay("nope")).toBe("nope");
	});
});
