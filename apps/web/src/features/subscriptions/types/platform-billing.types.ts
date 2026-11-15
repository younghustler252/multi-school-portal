import type { PaginationMeta } from "@/types/api-response";
import type { PublicPlan } from "@/features/plans/types/plan.types";
import type { BillingCycle, Invoice, InvoiceStatus, PaymentMethod, Subscription, SubscriptionStatus } from "./billing.types";

/* Mirrors apps/api/src/modules/subscriptions/usecases/platform/platform-billing.usecases.ts (mounted at /platform/subscriptions). */

export interface PlatformSubscription extends Subscription {
	schoolName: string;
	schoolSubdomain: string;
	planName: string;
	/** What this subscription brings in per month, whatever its billing cycle. */
	monthlyEquivalentKobo: number;
}

export interface PlatformInvoice extends Invoice {
	schoolId: string;
	schoolName: string;
	schoolSubdomain: string;
}

export interface PlatformBillingStats {
	mrrKobo: number;
	arrKobo: number;
	collectedThisMonthKobo: number;
	overdueInvoices: number;
	overdueAmountKobo: number;
	payingSchools: number;
	subscriptionsByStatus: Partial<Record<SubscriptionStatus, number>>;
	planDistribution: { planId: string; planName: string; schoolCount: number }[];
	/** mrrKobo here is what was collected that month. */
	revenueTrend: { month: string; mrrKobo: number }[];
}

/** One school's billing in full (GET /platform/subscriptions/:schoolId). */
export interface SchoolBilling {
	subscription: Subscription;
	plan: PublicPlan | null;
	recentInvoices: Invoice[];
	paymentMethod: PaymentMethod | null;
}

export interface ListPlatformSubscriptionsParams {
	page?: number;
	limit?: number;
	status?: SubscriptionStatus;
	planId?: string;
}

export interface ListPlatformInvoicesParams {
	page?: number;
	limit?: number;
	status?: InvoiceStatus;
	overdue?: boolean;
}

export interface Paged<T> {
	data: T[];
	meta: PaginationMeta;
}

export interface PlatformPlanChangeDto {
	planId: string;
	billingCycle?: BillingCycle;
	/** ISO date; a complimentary plan can end on a chosen date. */
	periodEndsAt?: string;
	reason: string;
}

export interface ExtendPeriodDto {
	days: number;
	reason: string;
}

export interface MarkPaidDto {
	reference: string;
	note?: string;
}
