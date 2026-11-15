import type { PaginationMeta } from "@/types/api-response";
import type { PublicPlan } from "@/features/plans/types/plan.types";

/* Mirrors apps/api/src/modules/subscriptions (mappers + use cases); docs/backend/modules/subscriptions.md. Dates arrive as ISO strings. */

export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "suspended" | "cancelled" | "expired";
export type InvoiceStatus = "open" | "paid" | "void" | "uncollectible";

export interface Subscription {
	id: string;
	schoolId: string;
	planId: string;
	status: SubscriptionStatus;
	billingCycle: BillingCycle;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	trialEndsAt: string | null;
	cancelAtPeriodEnd: boolean;
	cancelledAt: string | null;
	autoRenew: boolean;
	nextBillingDate: string | null;
	scheduledDowngradePlanId: string | null;
	lapsedPlanId: string | null;
	createdAt: string;
}

export interface InvoiceItem {
	kind: string;
	description: string;
	amountKobo: number;
}

export interface Invoice {
	id: string;
	number: string;
	reason: "renewal" | "upgrade" | "adjustment" | string;
	status: InvoiceStatus;
	billingCycle: BillingCycle;
	planId: string;
	periodStart: string;
	periodEnd: string;
	subtotalKobo: number;
	discountKobo: number;
	totalKobo: number;
	amountPaidKobo: number;
	dueDate: string;
	issuedAt: string;
	paidAt: string | null;
	lastFailureReason: string | null;
	note: string | null;
	isOverdue: boolean;
	items: InvoiceItem[];
}

/** A saved card. The API never returns the card's authorization code. */
export interface PaymentMethod {
	id: string;
	brand: string | null;
	last4: string | null;
	expMonth: number | null;
	expYear: number | null;
	bank: string | null;
	isDefault: boolean;
}

export interface UsageMeter {
	key: string;
	name: string;
	/** null = unlimited */
	limit: number | null;
	used: number;
}

/** GET /subscriptions: everything the billing page needs in one call. */
export interface BillingSummary {
	subscription: Subscription;
	plan: PublicPlan;
	standing: "good" | "past_due";
	/** When a past-due school drops to the Free plan. */
	graceEndsAt: string | null;
	upcomingInvoice: Invoice | null;
	openInvoices: Invoice[];
	paymentMethod: PaymentMethod | null;
	scheduledDowngrade: { planId: string; planName: string; effectiveAt: string } | null;
	/** After a lapse the school can return to its former paid plan. */
	restorePlan: { planId: string; planName: string } | null;
	usage: UsageMeter[];
}

export interface PlanChangeInput {
	planId: string;
	billingCycle: BillingCycle;
	couponCode?: string;
}

export interface QuoteItem {
	kind: "plan" | "setup_fee" | "proration_credit" | "discount" | "adjustment";
	description: string;
	amountKobo: number;
}

/** POST /subscriptions/preview: what a change would cost. Creates nothing. */
export interface PlanChangePreview {
	fromPlan: string;
	toPlan: string;
	billingCycle: BillingCycle;
	items: QuoteItem[];
	subtotalKobo: number;
	discountKobo: number;
	totalKobo: number;
	newPeriodStart: string;
	newPeriodEnd: string;
	/** true: same renewal date as now (price difference only); false: a new period starts today. */
	keepsRenewalDate: boolean;
}

/** The checkout the person is sent to. The return address is built by the server. */
export interface CheckoutStart {
	authorizationUrl: string;
	reference: string;
	amountKobo: number;
}

export type ChangePlanResult =
	| { status: "applied"; invoiceId: string; subscription: Subscription | null }
	| ({ status: "requires_payment"; invoiceId: string; totalKobo: number } & CheckoutStart);

export interface VerifyPaymentResult {
	status: "pending" | "success" | "failed" | "abandoned";
	failureReason: string | null;
	invoice: Invoice | null;
	subscription: Subscription | null;
}

export interface DowngradeResult {
	subscription: Subscription;
	effectiveAt: string;
	toPlan: string;
}

export interface ListInvoicesParams {
	page?: number;
	limit?: number;
	status?: InvoiceStatus;
}

export interface InvoiceList {
	data: Invoice[];
	meta: PaginationMeta;
}
