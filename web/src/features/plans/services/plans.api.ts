import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PlanResponseData } from "../types/plan.types";

export const plansApi = {
	list: (): Promise<ApiResponse<PlanResponseData[]>> =>
		API.get("/plans"),
};
