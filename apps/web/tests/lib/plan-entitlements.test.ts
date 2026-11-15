import { describe, expect, it } from "vitest";
import { capacityLabel, capacityOf, comparisonGroups } from "@/features/plans/lib/plan-entitlements";
import type { PlanEntitlementView } from "@/features/plans/types/plan.types";

const ent = (o: Partial<PlanEntitlementView> & { key: string }): PlanEntitlementView => ({
	name: o.key, description: null, module: "general", kind: "BOOLEAN", unit: null, isActive: true, granted: true, value: true, unlimited: false, ...o,
});
const plan = (...entitlements: PlanEntitlementView[]) => ({ entitlements });

describe("capacityOf / capacityLabel", () => {
	it("reads limits, unlimited and missing grants", () => {
		expect(capacityOf(plan(ent({ key: "students.max", kind: "LIMIT", value: 200 })), "students.max")).toEqual({ kind: "limited", value: 200 });
		expect(capacityOf(plan(ent({ key: "students.max", kind: "LIMIT", value: null, unlimited: true })), "students.max")).toEqual({ kind: "unlimited" });
		expect(capacityOf(plan(), "students.max")).toEqual({ kind: "none" });
	});
	it("treats a limit of 0 as no capacity, matching enforcement", () => {
		expect(capacityOf(plan(ent({ key: "staff.max", kind: "LIMIT", value: 0 })), "staff.max")).toEqual({ kind: "none" });
	});
	it("labels", () => {
		const p = plan(ent({ key: "students.max", kind: "LIMIT", value: 1000 }), ent({ key: "staff.max", kind: "LIMIT", value: null, unlimited: true }));
		expect(capacityLabel(p, "students.max", "students")).toBe("Up to 1,000 students");
		expect(capacityLabel(p, "staff.max", "staff")).toBe("Unlimited staff");
		expect(capacityLabel(plan(), "staff.max", "staff")).toBeNull();
	});
	it("does not crash on a plan without an entitlements list", () => {
		expect(capacityOf({} as never, "students.max")).toEqual({ kind: "none" });
		expect(comparisonGroups([{} as never])).toEqual([]);
	});
});

describe("comparisonGroups", () => {
	const free = plan(ent({ key: "a.email", name: "Email", module: "comms" }), ent({ key: "students.max", name: "Students", module: "limits", kind: "LIMIT", value: 50 }));
	const pro = plan(ent({ key: "a.email", name: "Email", module: "comms" }), ent({ key: "a.sms", name: "SMS", module: "comms" }), ent({ key: "students.max", name: "Students", module: "limits", kind: "LIMIT", value: null, unlimited: true }));

	it("groups the union of features by module, one cell per plan", () => {
		const groups = comparisonGroups([free, pro]);
		expect(groups.map((g) => g.module)).toEqual(["comms", "limits"]);
		const sms = groups[0].rows.find((r) => r.key === "a.sms")!;
		expect(sms.cells).toEqual([{ kind: "excluded" }, { kind: "included" }]);
		const students = groups[1].rows[0];
		expect(students.cells).toEqual([{ kind: "text", text: "50" }, { kind: "text", text: "Unlimited" }]);
	});
	it("skips features that are not active yet (not enforced)", () => {
		expect(comparisonGroups([plan(ent({ key: "x", isActive: false }))])).toEqual([]);
	});
	it("a boolean granted as false, or not granted, is excluded", () => {
		const g = comparisonGroups([plan(ent({ key: "k", value: false })), plan(ent({ key: "k", granted: false }))]);
		expect(g[0].rows[0].cells).toEqual([{ kind: "excluded" }, { kind: "excluded" }]);
	});
});
