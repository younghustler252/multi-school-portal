import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { SubscriptionResponseData, UpgradePlanDto, CancelSubscriptionDto, MySubscriptionResponseData } from "../types/subscription.types";

export const subscriptionApi = {

	getMySubscription: (): Promise<ApiResponse<MySubscriptionResponseData>> =>
	    API.get("/subscriptions/me"),

	upgrade: (data: UpgradePlanDto): Promise<ApiResponse<SubscriptionResponseData>> =>
		API.put("/subscriptions/me/upgrade", data),

	cancel: (data: CancelSubscriptionDto): Promise<ApiResponse<SubscriptionResponseData>> =>
		API.delete("/subscriptions/me", { data }),

};