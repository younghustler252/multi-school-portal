import { SubscriptionResponseData } from "@/features/subscriptions/types/subscription.types";

export interface AdminSubscriptionResponseData extends SubscriptionResponseData {
	schoolName: string;
	planName: string;
}

export interface ListSubscriptionsParams {
	page?: number;
	limit?: number;
	status?: string;
}


export interface SubscriptionStats {
	active: number;
	trialing: number;
	pastDue: number;
	expired: number;
	onFreePlan: number;
}