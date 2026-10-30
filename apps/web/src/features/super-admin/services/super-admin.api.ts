import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PlatformStats, PlatformUserResponseData, ListUsersParams, MrrTrendEntry } from "../types/super-admin.types";

export const superAdminApi = {

	getStats: (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<PlatformStats>> =>
		API.get("/super-admin/stats", { params }),

	getMrrTrend: (months = 6): Promise<ApiResponse<MrrTrendEntry[]>> =>
		API.get("/super-admin/stats/mrr-trend", { params: { months } }),

	listUsers: (params: ListUsersParams): Promise<ApiResponse<PlatformUserResponseData[]>> =>
		API.get("/super-admin/users", { params }),

	deactivateUser: (userId: string): Promise<ApiResponse<null>> =>
		API.delete(`/super-admin/users/${userId}`),

	impersonateSchool: (schoolId: string): Promise<ApiResponse<{ accessToken?: string; redirectUrl?: string }>> =>
		API.post(`/super-admin/schools/${schoolId}/impersonate`),

};