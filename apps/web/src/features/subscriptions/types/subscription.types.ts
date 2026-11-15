/*
| LEGACY shapes, kept only because the super-admin screens still import them (SubscriptionResponseData,
| BillingHistoryEntry). The school's own billing uses ./billing.types.ts, which matches the API. These go when the
| super-admin subscription screens are moved over (next M6 stage).
*/
import { PaymentStatus } from "@/features/payments/types/payment.types";
import { PaginationMeta } from "@/types/api-response";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";
export type BillingCycle = "monthly" | "yearly";

export interface SubscriptionResponseData {
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
	setupFeePaid: boolean;
	nextBillingDate: string | null;
	createdAt: string;
}

export interface BillingHistoryEntry {
	id: string;
	subscriptionId: string;
	amountKobo: number;
	status: PaymentStatus;
	billingCycle: BillingCycle;
	paystackReference: string | null;
	paidAt: string | null;
	failureReason: string | null;
	createdAt: string;
}

export interface BillingHistoryResponse {
	data: BillingHistoryEntry[];
	meta: PaginationMeta;
}

export interface ListBillingHistoryParams {
	page?: number;
	limit?: number;
}