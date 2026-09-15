import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	SubscriptionResponseData,
	UpgradePlanDto,
	CancelSubscriptionDto,
	MySubscriptionResponseData,
	InitiateUpgradeResponseData,
	VerifyTransactionResult,
	ToggleAutoRenewDto,
	ToggleAutoRenewResult,
	ListBillingHistoryParams,
	BillingHistoryEntry,
	BillingHistoryResponse
} from "../types/subscription.types";

export const subscriptionApi = {

	getMySubscription: (): Promise<ApiResponse<MySubscriptionResponseData>> =>
		API.get("/subscriptions/me"),

	upgrade: (data: UpgradePlanDto): Promise<ApiResponse<InitiateUpgradeResponseData>> =>
		API.put("/subscriptions/me/upgrade", data),

	cancel: (data: CancelSubscriptionDto): Promise<ApiResponse<SubscriptionResponseData>> =>
		API.delete("/subscriptions/me", { data }),

	verifyUpgrade: (reference: string): Promise<ApiResponse<VerifyTransactionResult>> =>
		API.get("/subscriptions/me/upgrade/verify", { params: { reference } }),

	toggleAutoRenew: (data: ToggleAutoRenewDto): Promise<ApiResponse<ToggleAutoRenewResult>> =>
		API.put("/subscriptions/auto-renew", data),

	getBillingHistory: (
		params: ListBillingHistoryParams
	): Promise<ApiResponse<BillingHistoryResponse>> =>
		API.get("/subscriptions/billing-history", { params }),

};