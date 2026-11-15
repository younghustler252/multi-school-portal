import type { BillingSummary, InvoiceStatus, SubscriptionStatus } from "../types/billing.types";

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
	trialing: "Trial", active: "Active", past_due: "Payment overdue", suspended: "Suspended", cancelled: "Cancelled", expired: "Expired",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { open: "Unpaid", paid: "Paid", void: "Cancelled", uncollectible: "Written off" };

export type Notice = { tone: "warning" | "info"; title: string; body: string };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

/** The banners the billing page shows, most urgent first. Only states the API reports; nothing is inferred. */
export function billingNotices(s: BillingSummary): Notice[] {
	const out: Notice[] = [];
	if (s.standing === "past_due") {
		out.push({
			tone: "warning",
			title: "Payment overdue",
			body: s.graceEndsAt
				? `Your plan stays active until ${day(s.graceEndsAt)}. Pay the open invoice before then to keep ${s.plan.name}.`
				: "Pay the open invoice to keep your current plan.",
		});
	}
	if (s.subscription.cancelAtPeriodEnd) {
		out.push({ tone: "info", title: "Cancellation scheduled", body: `Your school moves to the Free plan on ${day(s.subscription.currentPeriodEnd)}. You can resume until then.` });
	}
	if (s.scheduledDowngrade) {
		out.push({ tone: "info", title: `Moving to ${s.scheduledDowngrade.planName}`, body: `This change takes effect on ${day(s.scheduledDowngrade.effectiveAt)}.` });
	}
	if (s.restorePlan) {
		out.push({ tone: "info", title: `Your ${s.restorePlan.planName} plan lapsed`, body: `Your data is untouched. You can return to ${s.restorePlan.planName} from Change plan.` });
	}
	return out;
}

/** "62%" style fill for a usage bar; null when unlimited. Over the limit stays at 100. */
export function usagePercent(used: number, limit: number | null): number | null {
	if (limit === null) return null;
	if (limit <= 0) return used > 0 ? 100 : 0;
	return Math.min(100, Math.round((used / limit) * 100));
}
