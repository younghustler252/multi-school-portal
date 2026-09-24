import { useMutation } from "@tanstack/react-query";
import { feedbackApi } from "../services/feedback.api";
import { SubmitFeedbackDto } from "../types/feedback.types";

export function useSubmitFeedback() {
	return useMutation({
		mutationFn: async (data: SubmitFeedbackDto) => {
			const res = await feedbackApi.submit(data);
			if (!res.success) throw res;
			return res.data;
		},
	});
}