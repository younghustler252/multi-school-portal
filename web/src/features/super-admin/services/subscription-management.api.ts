import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { AdminSubscriptionResponseData, ListSubscriptionsParams } from "../types/subscription-management.types";

export const subscriptionManagementApi = {

	list: (params: ListSubscriptionsParams): Promise<ApiResponse<AdminSubscriptionResponseData[]>> =>
		API.get("/subscriptions", { params }),

	getBySchool: (schoolId: string): Promise<ApiResponse<AdminSubscriptionResponseData>> =>
		API.get(`/subscriptions/school/${schoolId}`),

	deactivate: (id: string): Promise<ApiResponse<null>> =>
		API.put(`/subscriptions/${id}/deactivate`),

};