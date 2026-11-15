import { describe, expect, it } from "vitest";
import { draftFrom, draftProblem, entitlementChanges, koboToNaira, nairaToKobo, priceProblem } from "@/features/plans/lib/plan-admin";
import type { PlanEntitlementView } from "@/features/plans/types/plan.types";

const f = (o: Partial<PlanEntitlementView> & { key: string }): PlanEntitlementView => ({
	name: o.key, description: null, module: "m", kind: "BOOLEAN", unit: null, isActive: true, granted: false, value: false, unlimited: false, ...o,
});

describe("money", () => {
	it("parses naira entries to kobo", () => {
		expect(nairaToKobo("25,000")).toBe(2_500_000);
		expect(nairaToKobo("₦ 10.5")).toBe(1050);
		expect(nairaToKobo("0")).toBe(0);
		expect(nairaToKobo("")).toBeNull();
		expect(nairaToKobo("-5")).toBeNull();
		expect(nairaToKobo("1.234")).toBeNull();
		expect(nairaToKobo("abc")).toBeNull();
	});
	it("shows kobo as naira", () => expect(koboToNaira(1_000_000)).toBe("10000"));
});

describe("priceProblem", () => {
	it("allows normal and discounted yearly prices", () => {
		expect(priceProblem(1_000_000, 10_000_000)).toBeNull();
		expect(priceProblem(1_000_000, 12_000_000)).toBeNull();
		expect(priceProblem(0, 0)).toBeNull();
	});
	it("rejects yearly above 12x monthly, and half-free plans", () => {
		expect(priceProblem(1_000_000, 12_000_001)).toMatch(/12 months/);
		expect(priceProblem(0, 100)).toMatch(/free/i);
		expect(priceProblem(100, 0)).toMatch(/free/i);
	});
});

describe("entitlementChanges", () => {
	const features = [
		f({ key: "grading.custom", granted: true, value: true }),
		f({ key: "sms", granted: false, value: false }),
		f({ key: "students.max", kind: "LIMIT", granted: true, value: 200 }),
		f({ key: "staff.max", kind: "LIMIT", granted: true, value: null, unlimited: true }),
		f({ key: "branches.max", kind: "LIMIT", granted: false, value: 0 }),
	];
	const base = () => Object.fromEntries(features.map((x) => [x.key, draftFrom(x)]));

	it("sends nothing when nothing changed", () => expect(entitlementChanges(features, base())).toEqual([]));

	it("turns booleans on and off", () => {
		const d = base();
		d["sms"] = { ...d["sms"], included: true };
		d["grading.custom"] = { ...d["grading.custom"], included: false };
		expect(entitlementChanges(features, d)).toEqual([{ featureKey: "grading.custom", boolValue: false }, { featureKey: "sms", boolValue: true }]);
	});

	it("changes a limit, makes it unlimited, grants one, removes one", () => {
		const d = base();
		d["students.max"] = { ...d["students.max"], value: "300" };
		d["staff.max"] = { included: true, unlimited: false, value: "50" };
		d["branches.max"] = { included: true, unlimited: true, value: "" };
		expect(entitlementChanges(features, d)).toEqual([
			{ featureKey: "students.max", limitValue: 300 },
			{ featureKey: "staff.max", limitValue: 50 },
			{ featureKey: "branches.max", limitValue: null },
		]);
		const d2 = base();
		d2["students.max"] = { ...d2["students.max"], included: false };
		expect(entitlementChanges(features, d2)).toEqual([{ featureKey: "students.max", remove: true }]);
	});

	it("limit 0 is a real grant of no capacity, distinct from not granted", () => {
		const zero = [f({ key: "x", kind: "LIMIT", granted: true, value: 0 })];
		expect(draftFrom(zero[0])).toEqual({ included: true, unlimited: false, value: "0" });
	});

	it("flags values that can't be saved", () => {
		const d = base();
		d["students.max"] = { ...d["students.max"], value: "12.5" };
		expect(draftProblem(features, d)).toMatch(/students.max: enter a whole number/);
		d["students.max"] = { ...d["students.max"], value: "12" };
		expect(draftProblem(features, d)).toBeNull();
		d["branches.max"] = { included: true, unlimited: false, value: "" };
		expect(draftProblem(features, d)).toMatch(/branches.max/);
	});
});
