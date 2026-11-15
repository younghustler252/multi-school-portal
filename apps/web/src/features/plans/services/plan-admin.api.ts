import { apiCall } from "@/lib/api/api-client";
import type { AdminPlan, ClonePlanDto, CreatePlanDto, EntitlementChange, UpdatePlanDto } from "../types/plan-admin.types";

/* Platform plans (admin host): view = platform.plans.view, every change = platform.plans.manage. Calls throw ApiError. */
export const planAdminApi = {
	list: () => apiCall<AdminPlan[]>({ method: "GET", url: "/platform/plans" }),
	get: (id: string) => apiCall<AdminPlan>({ method: "GET", url: `/platform/plans/${id}` }),
	create: (data: CreatePlanDto) => apiCall<AdminPlan>({ method: "POST", url: "/platform/plans", data }),
	update: (id: string, data: UpdatePlanDto) => apiCall<AdminPlan>({ method: "PUT", url: `/platform/plans/${id}`, data }),
	setEntitlements: (id: string, entitlements: EntitlementChange[]) => apiCall<AdminPlan>({ method: "PUT", url: `/platform/plans/${id}/entitlements`, data: { entitlements } }),
	deactivate: (id: string) => apiCall<AdminPlan>({ method: "PUT", url: `/platform/plans/${id}/deactivate` }),
	reactivate: (id: string) => apiCall<AdminPlan>({ method: "PUT", url: `/platform/plans/${id}/reactivate` }),
	clone: (id: string, data: ClonePlanDto) => apiCall<AdminPlan>({ method: "POST", url: `/platform/plans/${id}/clone`, data }),
};
