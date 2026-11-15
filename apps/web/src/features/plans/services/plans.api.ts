import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { PublicPlan } from "../types/plan.types";

export const plansApi = {
	/** The public pricing list (GET /plans): active, public plans with their entitlements. */
	listPublic: (): Promise<ApiResponse<PublicPlan[]>> => API.get("/plans"),

};
