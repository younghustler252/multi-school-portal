import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import { SubmitFeedbackDto } from "../types/feedback.types";

export const feedbackApi = {
	submit: (data: SubmitFeedbackDto): Promise<ApiResponse<null>> =>
		API.post("/feedback", data),
};