import { useQuery, useMutation } from "@tanstack/react-query";
import { promotionApi } from "../services/promotion.api";
import { PromoteStudentsDto } from "../types/promotion.types";

export function usePromotionPreview(termId: string | undefined) {
	return useQuery({
		queryKey: ["enrolment", "promotion-preview", termId],
		queryFn: async () => {
			const res = await promotionApi.getPreview({ termId: termId! });
			if (!res.success) throw res;
			return res.data; // PromotionPreviewRow[]
		},
		enabled: !!termId,
	});
}

export function usePromoteStudents() {
	return useMutation({
		mutationFn: async (data: PromoteStudentsDto) => {
			const res = await promotionApi.promote(data);
			if (!res.success) throw res;
			return res.data;
		},
		// No query invalidation here — a successful promotion is a one-way
		// action the admin gets redirected away from; the caller handles
		// navigation, not cache refresh.
	});
}

