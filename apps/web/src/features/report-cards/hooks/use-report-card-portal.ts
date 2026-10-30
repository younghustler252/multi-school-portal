import { useQuery } from "@tanstack/react-query";
import { reportCardApi } from "../services/report-card.api";

export function useMyReportCards(termId?: string) {
	return useQuery({
		queryKey: ["report-card-portal", "me", termId],
		queryFn: async () => {
			const res = await reportCardApi.getMine({ termId });
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenReportCards(params: { studentId?: string; termId?: string }) {
	return useQuery({
		queryKey: ["report-card-portal", "my-children", params],
		queryFn: async () => {
			const res = await reportCardApi.getMyChildren(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}