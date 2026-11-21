import { describe, expect, it } from "vitest";
import {
	attendanceView, feesView, formatSchoolDay, hasNoRoleSections, planExpiryView, usageView,
} from "@/lib/school-dashboard";
import type { SchoolDashboardData } from "@/features/school/types/school.types";

describe("attendanceView", () => {
	it("counts present and late as attended, out of everyone marked", () => {
		const v = attendanceView({ date: "2026-11-21", present: 80, late: 10, absent: 8, excused: 2 });
		expect(v.marked).toBe(100);
		expect(v.attended).toBe(90);
		expect(v.ratePercent).toBe(90);
	});

	it("has no rate (not 0%) until something is marked", () => {
		const v = attendanceView({ date: "2026-11-21", present: 0, late: 0, absent: 0, excused: 0 });
		expect(v.ratePercent).toBeNull();
		expect(v.marked).toBe(0);
	});

	it("lists the four segments in a fixed order", () => {
		const v = attendanceView({ date: "2026-11-21", present: 1, late: 2, absent: 3, excused: 4 });
		expect(v.segments.map((s) => s.key)).toEqual(["present", "late", "absent", "excused"]);
		expect(v.segments.map((s) => s.count)).toEqual([1, 2, 3, 4]);
	});

	it("rounds to a whole percent", () => {
		expect(attendanceView({ date: "d", present: 2, late: 0, absent: 1, excused: 0 }).ratePercent).toBe(67);
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

describe("hasNoRoleSections", () => {
	const base: SchoolDashboardData = {
		school: { name: "S", status: "active", verificationStatus: "verified" },
		plan: { name: "Free", status: "none", expiresAt: null, studentLimit: null, staffLimit: null },
		people: null, academics: null, fees: null, attendance: null,
	};

	it("is true when every gated section is null", () => {
		expect(hasNoRoleSections(base)).toBe(true);
	});

	it("is false when any section arrived", () => {
		expect(hasNoRoleSections({ ...base, attendance: { date: "2026-11-21", present: 0, late: 0, absent: 0, excused: 0 } })).toBe(false);
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
