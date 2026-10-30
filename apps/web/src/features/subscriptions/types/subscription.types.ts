import { PlanResponseData } from "@/features/plans/types/plan.types";
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

export interface MySubscriptionResponseData {
	subscription: SubscriptionResponseData;
	plan: PlanResponseData;
}
export interface UpgradePlanDto {
	planId: string;
	billingCycle: BillingCycle;
	callbackUrl: string;
	couponCode?: string;
}

export interface InitiateUpgradeResponseData {
	authorizationUrl: string;
	reference: string;
	amountKobo: number;
}

export interface CancelSubscriptionDto {
	cancelAtPeriodEnd: boolean;
}

export interface VerifyTransactionResult {
	success: boolean;
	alreadyVerified: boolean;
	message: string;
	reference: string;
	subscriptionId: string;
}

export interface ToggleAutoRenewDto {
	enabled: boolean;
}

export interface ToggleAutoRenewResult {
	autoRenew: boolean;
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