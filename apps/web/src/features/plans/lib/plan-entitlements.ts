import type { PlanEntitlementView, PublicPlan } from "../types/plan.types";

/*
| Reading "what a plan includes" from its entitlements list. Nothing here knows the feature list: the API sends each
| feature's key, name and module, so the pricing table is built from the data and a new feature shows up by itself.
*/

/** The capacity keys the pricing cards headline. */
export const LIMIT_KEYS = { students: "students.max", staff: "staff.max" } as const;

export type Capacity = { kind: "unlimited" } | { kind: "limited"; value: number } | { kind: "none" };

function find(plan: Pick<PublicPlan, "entitlements">, key: string): PlanEntitlementView | undefined {
	return (plan.entitlements ?? []).find((e) => e.key === key);
}

/**
 * How much of a limit/quota feature the plan gives. A limit of 0 means no capacity (that is how the backend enforces it),
 * even though the public list marks any grant row as granted (backend item REM-062), so 0 is shown as not included.
 */
export function capacityOf(plan: Pick<PublicPlan, "entitlements">, key: string): Capacity {
	const e = find(plan, key);
	if (!e || !e.granted) return { kind: "none" };
	if (e.unlimited || e.value === null) return { kind: "unlimited" };
	if (typeof e.value === "number") return e.value > 0 ? { kind: "limited", value: e.value } : { kind: "none" };
	return { kind: "none" };
}

/** "Up to 200 students" / "Unlimited students" / null when the plan does not say. */
export function capacityLabel(plan: Pick<PublicPlan, "entitlements">, key: string, noun: string): string | null {
	const c = capacityOf(plan, key);
	if (c.kind === "unlimited") return `Unlimited ${noun}`;
	if (c.kind === "limited") return `Up to ${c.value.toLocaleString("en-NG")} ${noun}`;
	return null;
}

export type Cell = { kind: "included" } | { kind: "excluded" } | { kind: "text"; text: string };

function cellOf(e: PlanEntitlementView | undefined): Cell {
	if (!e || !e.granted) return { kind: "excluded" };
	if (e.kind === "BOOLEAN") return e.value === false ? { kind: "excluded" } : { kind: "included" };
	if (e.kind === "LIMIT" || e.kind === "QUOTA") {
		if (e.unlimited || e.value === null) return { kind: "text", text: "Unlimited" };
		if (typeof e.value !== "number" || e.value <= 0) return { kind: "excluded" };
		return { kind: "text", text: `${e.value.toLocaleString("en-NG")}${e.unit ? ` ${e.unit}` : ""}` };
	}
	return typeof e.value === "string" && e.value ? { kind: "text", text: e.value } : { kind: "included" };
}

export interface ComparisonRow { key: string; label: string; cells: Cell[] }
export interface ComparisonGroup { module: string; rows: ComparisonRow[] }

/**
 * One row per active feature that any of the plans lists, grouped by module, in the order the API sends them.
 * `cells[i]` belongs to `plans[i]`.
 */
export function comparisonGroups(plans: Array<Pick<PublicPlan, "entitlements">>): ComparisonGroup[] {
	const order: string[] = [];
	const meta = new Map<string, { label: string; module: string }>();
	for (const plan of plans) {
		for (const e of plan.entitlements ?? []) {
			if (!e.isActive || meta.has(e.key)) continue;
			meta.set(e.key, { label: e.name, module: e.module });
			order.push(e.key);
		}
	}
	const groups = new Map<string, ComparisonRow[]>();
	for (const key of order) {
		const { label, module } = meta.get(key)!;
		const row: ComparisonRow = { key, label, cells: plans.map((p) => cellOf(find(p, key))) };
		if (!groups.has(module)) groups.set(module, []);
		groups.get(module)!.push(row);
	}
	return [...groups].map(([module, rows]) => ({ module, rows }));
}

/**
 * Whether a plan includes a feature. The API's plan summary lists only what the plan GRANTS (PlanEntitlementService.describe,
 * public mode), so a key that is missing means "not included", which is also how the API enforces it (a missing grant denies).
 * A limit of 0 is no capacity.
 */
export function planIncludes(plan: Pick<PublicPlan, "entitlements">, key: string): boolean {
	const e = find(plan, key);
	if (!e || !e.granted) return false;
	if (e.kind === "BOOLEAN") return e.value !== false;
	if (e.kind === "LIMIT" || e.kind === "QUOTA") return e.unlimited || e.value === null || (typeof e.value === "number" && e.value > 0);
	return e.value !== null && e.value !== "";
}
