import { PlanResponseData } from "@/features/plans/types/plan.types";

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
	setupFeePaid: boolean;
	nextBillingDate: string | null;
	createdAt: string;
}

// Real shape returned by GET /subscriptions/me
export interface MySubscriptionResponseData {
	subscription: SubscriptionResponseData;
	plan: PlanResponseData;
}

export interface UpgradePlanDto {
	planId: string;
	billingCycle: BillingCycle;
	couponCode?: string;
}

export interface CancelSubscriptionDto {
	cancelAtPeriodEnd: boolean;
}