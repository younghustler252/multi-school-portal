import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { EnrichedFeedback, ListFeedbackParams, UpdateFeedbackDto } from "../types/feedback-management.types";

export const feedbackManagementApi = {
	list: (params: ListFeedbackParams): Promise<ApiResponse<EnrichedFeedback[]>> =>
		API.get("feedback", { params }),

	update: (id: string, data: UpdateFeedbackDto): Promise<ApiResponse<EnrichedFeedback>> =>
		API.put(`/feedback/${id}`, data),
};