import type { BillingCycle, SubscriptionStatus } from "../types/billing.types";

/*
| Which flow a plan choice belongs to. Mirrors PlanChangeService.prepare on the API so the dialog offers the right
| action up front (the API stays the authority and still rejects anything else):
|   same plan and cycle          -> nothing to change (a trial may start paying on the same plan)
|   free target / cheaper plan   -> a downgrade, scheduled for the end of the current period
|   anything else                -> an upgrade or cycle switch, charged now from a quote
*/

interface Priced {
	id: string;
	monthlyPriceKobo: number;
	yearlyPriceKobo: number;
}

export type ChangeKind = "same" | "upgrade" | "downgrade";

export function priceFor(plan: Priced, cycle: BillingCycle): number {
	return cycle === "monthly" ? plan.monthlyPriceKobo : plan.yearlyPriceKobo;
}

/** What a plan costs per month on a cycle, so yearly and monthly plans can be compared. */
export function monthlyEquivalent(plan: Priced, cycle: BillingCycle): number {
	return cycle === "monthly" ? plan.monthlyPriceKobo : plan.yearlyPriceKobo / 12;
}

export function classifyChange(
	current: { plan: Priced; cycle: BillingCycle; status: SubscriptionStatus },
	target: Priced,
	targetCycle: BillingCycle,
): ChangeKind {
	const samePlan = target.id === current.plan.id;
	if (samePlan && targetCycle === current.cycle && current.status !== "trialing") return "same";
	if (priceFor(target, targetCycle) <= 0) return "downgrade";
	const currentMonthly = current.status === "trialing" ? 0 : monthlyEquivalent(current.plan, current.cycle);
	if (!samePlan && currentMonthly > 0 && monthlyEquivalent(target, targetCycle) < currentMonthly) return "downgrade";
	return "upgrade";
}

/** One line for a quote item: credits and discounts are negative amounts. */
export function isCredit(kind: string): boolean {
	return kind === "proration_credit" || kind === "discount";
}
