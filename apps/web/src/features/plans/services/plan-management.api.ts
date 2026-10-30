import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PlanResponseData } from "../types/plan.types";
import { CreatePlanDto, UpdatePlanDto } from "../types/plan-management.types";

export const planManagementApi = {

	create: (data: CreatePlanDto): Promise<ApiResponse<PlanResponseData>> =>
		API.post("/plans", data),

	update: (id: string, data: UpdatePlanDto): Promise<ApiResponse<PlanResponseData>> =>
		API.put(`/plans/${id}`, data),

};