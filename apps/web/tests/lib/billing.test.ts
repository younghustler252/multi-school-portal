import { describe, expect, it } from "vitest";
import { classifyChange, monthlyEquivalent } from "@/features/subscriptions/lib/plan-change";
import { billingNotices, usagePercent } from "@/features/subscriptions/lib/billing-status";
import type { BillingSummary } from "@/features/subscriptions/types/billing.types";

const plan = (id: string, monthly: number, yearly = monthly * 10) => ({ id, monthlyPriceKobo: monthly, yearlyPriceKobo: yearly });
const free = plan("free", 0, 0), starter = plan("starter", 1_000_000, 10_000_000), standard = plan("standard", 2_500_000, 25_000_000);
const on = (p: ReturnType<typeof plan>, cycle: "monthly" | "yearly" = "monthly", status: "active" | "trialing" = "active") => ({ plan: p, cycle, status });

describe("classifyChange", () => {
	it("same plan and cycle is no change, except while trialing", () => {
		expect(classifyChange(on(starter), starter, "monthly")).toBe("same");
		expect(classifyChange(on(starter, "monthly", "trialing"), starter, "monthly")).toBe("upgrade");
	});
	it("a free or cheaper target is a downgrade, a dearer one an upgrade", () => {
		expect(classifyChange(on(standard), free, "monthly")).toBe("downgrade");
		expect(classifyChange(on(standard), starter, "monthly")).toBe("downgrade");
		expect(classifyChange(on(starter), standard, "monthly")).toBe("upgrade");
	});
	it("from Free anything paid is an upgrade", () => {
		expect(classifyChange(on(free), starter, "monthly")).toBe("upgrade");
	});
	it("a cycle switch on the same plan is an upgrade flow", () => {
		expect(classifyChange(on(starter, "monthly"), starter, "yearly")).toBe("upgrade");
	});
	it("compares yearly and monthly prices per month", () => {
		expect(monthlyEquivalent(starter, "yearly")).toBeCloseTo(833_333.33, 1);
		expect(classifyChange(on(standard, "monthly"), starter, "yearly")).toBe("downgrade");
	});
});

describe("usagePercent", () => {
	it("is null when unlimited and caps at 100", () => {
		expect(usagePercent(40, null)).toBeNull();
		expect(usagePercent(25, 50)).toBe(50);
		expect(usagePercent(80, 50)).toBe(100);
		expect(usagePercent(3, 0)).toBe(100);
		expect(usagePercent(0, 0)).toBe(0);
	});
});

describe("billingNotices", () => {
	const base = { subscription: { cancelAtPeriodEnd: false, currentPeriodEnd: "2026-12-01T00:00:00Z" }, plan: { name: "Starter" }, standing: "good", graceEndsAt: null, scheduledDowngrade: null, restorePlan: null } as unknown as BillingSummary;
	it("says nothing when everything is fine", () => expect(billingNotices(base)).toEqual([]));
	it("puts the overdue warning first, with the grace date", () => {
		const n = billingNotices({ ...base, standing: "past_due", graceEndsAt: "2026-12-05T00:00:00Z", subscription: { ...base.subscription, cancelAtPeriodEnd: true } });
		expect(n[0].tone).toBe("warning");
		expect(n[0].body).toContain("Starter");
		expect(n.map((x) => x.title)).toContain("Cancellation scheduled");
	});
	it("reports a scheduled downgrade and a restorable plan", () => {
		const n = billingNotices({ ...base, scheduledDowngrade: { planId: "f", planName: "Free", effectiveAt: "2026-12-01T00:00:00Z" }, restorePlan: { planId: "s", planName: "Standard" } });
		expect(n.map((x) => x.title)).toEqual(["Moving to Free", "Your Standard plan lapsed"]);
	});
});

import { ROUTES } from "@/lib/routes";

describe("checkout return address", () => {
	it("matches the address the API sends the browser back to (PlanChangeService.callbackUrl)", () => {
		expect(ROUTES.billing.callback).toBe("/billing/callback");
	});
});
