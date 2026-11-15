import { describe, expect, it } from "vitest";
import { buildExtend, buildMarkPaid, buildPlanChange, extendDaysProblem, markPaidProblem, periodEndProblem, reasonProblem } from "@/features/subscriptions/lib/platform-billing";

describe("reasonProblem", () => {
	it("needs 10 to 300 characters after trimming", () => {
		expect(reasonProblem("too short")).toMatch(/at least 10/);
		expect(reasonProblem("   short    ")).toMatch(/at least 10/);
		expect(reasonProblem("Goodwill after bank delay")).toBeNull();
		expect(reasonProblem("x".repeat(301))).toMatch(/under 300/);
	});
});

describe("extendDaysProblem", () => {
	it("accepts 1 to 90 whole days", () => {
		expect(extendDaysProblem("1")).toBeNull();
		expect(extendDaysProblem("90")).toBeNull();
		expect(extendDaysProblem("0")).toMatch(/1 to 90/);
		expect(extendDaysProblem("91")).toMatch(/1 to 90/);
		expect(extendDaysProblem("2.5")).toMatch(/whole number/);
		expect(extendDaysProblem("")).toMatch(/whole number/);
	});
});

describe("periodEndProblem", () => {
	const now = new Date("2026-11-15T12:00:00Z");
	it("allows empty and future dates only", () => {
		expect(periodEndProblem("", now)).toBeNull();
		expect(periodEndProblem("2026-12-01", now)).toBeNull();
		expect(periodEndProblem("2026-11-15", now)).toBeNull(); // end of today is still ahead of noon
		expect(periodEndProblem("2026-11-14", now)).toMatch(/future/);
		expect(periodEndProblem("nope", now)).toMatch(/valid/);
	});
});

describe("builders", () => {
	it("builds a plan change, omitting an empty end date", () => {
		expect(buildPlanChange({ planId: "p1", billingCycle: "yearly", periodEnd: "", reason: "  Pilot for a new school  " })).toEqual({ planId: "p1", billingCycle: "yearly", reason: "Pilot for a new school" });
		expect(buildPlanChange({ planId: "p1", billingCycle: "monthly", periodEnd: "2027-01-31", reason: "Pilot for a new school" }).periodEndsAt).toBe("2027-01-31T23:59:59.999Z");
	});
	it("builds extend and mark-paid bodies", () => {
		expect(buildExtend(" 14 ", " Bank delayed the transfer ")).toEqual({ days: 14, reason: "Bank delayed the transfer" });
		expect(buildMarkPaid(" TRF-1001 ", " ")).toEqual({ reference: "TRF-1001" });
		expect(buildMarkPaid("TRF-1001", " received 3 Nov ")).toEqual({ reference: "TRF-1001", note: "received 3 Nov" });
	});
	it("checks the transfer reference", () => {
		expect(markPaidProblem("ab", "")).toMatch(/reference/);
		expect(markPaidProblem("TRF-1", "")).toBeNull();
	});
});
