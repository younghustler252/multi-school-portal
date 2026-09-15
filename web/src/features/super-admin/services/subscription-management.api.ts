import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { AdminSubscriptionResponseData, SubscriptionStats, ListSubscriptionsParams} from "../types/subscription-management.types";
import { BillingHistoryEntry, ListBillingHistoryParams } from "@/features/subscriptions/types/subscription.types";

export const subscriptionManagementApi = {

	list: (params: ListSubscriptionsParams): Promise<ApiResponse<AdminSubscriptionResponseData[]>> =>
		API.get("/subscriptions", { params }),

	getBySchool: (schoolId: string): Promise<ApiResponse<AdminSubscriptionResponseData>> =>
		API.get(`/subscriptions/school/${schoolId}`),

	deactivate: (id: string): Promise<ApiResponse<null>> =>
		API.put(`/subscriptions/${id}/deactivate`),

	getBillingHistory: (
		schoolId: string,
		params: ListBillingHistoryParams,
	): Promise<ApiResponse<BillingHistoryEntry[]>> =>
		API.get(`/super-admin/schools/${schoolId}/billing-history`, { params }),

	getStats: (): Promise<ApiResponse<SubscriptionStats>> =>
		API.get("/super-admin/stats")

};