import type { PlanEntitlementView } from "../types/plan.types";
import type { EntitlementChange } from "../types/plan-admin.types";

/*
| Pure rules for the platform plan console: money entry and the price rules the API enforces, and turning an edited
| feature list into the minimal set of changes to send.
*/

/** "12,500.50" (naira) -> kobo, or null when it isn't a non-negative amount. */
export function nairaToKobo(input: string): number | null {
	const cleaned = input.replace(/[,\s₦]/g, "");
	if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
	return Math.round(Number(cleaned) * 100);
}

export function koboToNaira(kobo: number): string {
	return String(kobo / 100);
}

/** The API's price rules (docs/backend/modules/plans.md): yearly at most 12x monthly; a zero price must be zero on both cycles. */
export function priceProblem(monthlyKobo: number, yearlyKobo: number): string | null {
	if ((monthlyKobo === 0) !== (yearlyKobo === 0)) return "A free plan must be free on both monthly and yearly billing.";
	if (yearlyKobo > monthlyKobo * 12) return "The yearly price can't be more than 12 months at the monthly price.";
	return null;
}

/** What an editor row holds for one feature while it is being changed. */
export interface FeatureDraft {
	included: boolean;
	/** BOOLEAN needs none; LIMIT/QUOTA a whole number as text; ENUM free text. */
	value: string;
	unlimited: boolean;
}

export function draftFrom(e: PlanEntitlementView): FeatureDraft {
	if (e.kind === "LIMIT" || e.kind === "QUOTA") return { included: e.granted, unlimited: e.granted && e.unlimited, value: e.granted && !e.unlimited && typeof e.value === "number" ? String(e.value) : "" };
	if (e.kind === "ENUM") return { included: e.granted, unlimited: false, value: typeof e.value === "string" ? e.value : "" };
	return { included: e.granted, unlimited: false, value: "" };
}

const sameDraft = (a: FeatureDraft, b: FeatureDraft) => a.included === b.included && a.unlimited === b.unlimited && a.value === b.value;

export type DraftMap = Record<string, FeatureDraft>;

/** A message for the first row that can't be saved (a limit that isn't a whole number >= 0, an empty ENUM value), else null. */
export function draftProblem(features: PlanEntitlementView[], drafts: DraftMap): string | null {
	for (const f of features) {
		const d = drafts[f.key];
		if (!d || !d.included) continue;
		if ((f.kind === "LIMIT" || f.kind === "QUOTA") && !d.unlimited && !/^\d+$/.test(d.value.trim())) return `${f.name}: enter a whole number, or choose unlimited.`;
		if (f.kind === "ENUM" && d.value.trim() === "") return `${f.name}: enter a value.`;
	}
	return null;
}

/** Only the features whose draft differs from what the plan has now, in the form PUT .../entitlements takes. */
export function entitlementChanges(features: PlanEntitlementView[], drafts: DraftMap): EntitlementChange[] {
	const out: EntitlementChange[] = [];
	for (const f of features) {
		const d = drafts[f.key];
		if (!d || sameDraft(d, draftFrom(f))) continue;
		if (f.kind === "BOOLEAN") out.push({ featureKey: f.key, boolValue: d.included });
		else if (!d.included) out.push({ featureKey: f.key, remove: true });
		else if (f.kind === "ENUM") out.push({ featureKey: f.key, enumValue: d.value.trim() });
		else out.push({ featureKey: f.key, limitValue: d.unlimited ? null : Number(d.value.trim()) });
	}
	return out;
}
