import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbackManagementApi } from "../services/feedback-management.api";
import { ListFeedbackParams, UpdateFeedbackDto } from "../types/feedback-management.types";

export function useAdminFeedback(params: ListFeedbackParams) {
	return useQuery({
		queryKey: ["super-admin", "feedback", params],
		queryFn: async () => {
			const res = await feedbackManagementApi.list(params);
			if (!res.success) throw res;
			return { feedback: res.data, meta: res.meta };
		},
	});
}

export function useUpdateFeedback() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateFeedbackDto }) =>
			feedbackManagementApi.update(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "feedback"] }),
	});
}