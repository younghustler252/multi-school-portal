import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportCardApi } from "../services/report-card.api";
import { GenerateReportCardDto, BulkGenerateReportCardDto, UpdateReportCardDto, PublishReportCardsDto, ListReportCardsParams } from "../types/report-card.types";

export function useReportCards(params: ListReportCardsParams) {
	return useQuery({
		queryKey: ["report-cards", params],
		queryFn: async () => {
			const res = await reportCardApi.list(params);
			if (!res.success) throw res;
			return { reportCards: res.data, meta: res.meta };
		},
	});
}

export function useReportCard(id: string) {
	return useQuery({
		queryKey: ["report-cards", id],
		queryFn: async () => {
			const res = await reportCardApi.getById(id);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!id,
	});
}

export function useGenerateReportCard() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: GenerateReportCardDto) => {
			const res = await reportCardApi.generate(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-cards"] }),
	});
}

export function useBulkGenerateReportCards() {
	return useMutation({
		mutationFn: async (data: BulkGenerateReportCardDto) => {
			const res = await reportCardApi.bulkGenerate(data);
			if (!res.success) throw res;
			return res.data; // { message, jobId }
		},
	});
}

// Polls a bulk-generation job until it completes or fails
export function useBulkGenerateJobStatus(jobId: string | null) {
	return useQuery({
		queryKey: ["report-cards", "bulk-status", jobId],
		queryFn: async () => {
			if (!jobId) throw new Error("No job");
			const res = await reportCardApi.getBulkStatus(jobId);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!jobId,
		refetchInterval: (query) => {
			const state = query.state.data?.state;
			return state === "completed" || state === "failed" ? false : 1500;
		},
	});
}

export function useUpdateReportCard(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateReportCardDto) => {
			const res = await reportCardApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-cards"] }),
	});
}

export function usePublishReportCards() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: PublishReportCardsDto) => {
			const res = await reportCardApi.publish(data);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-cards"] }),
	});
}

export function useSendReportCard() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await reportCardApi.send(id);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report-cards"] }),
	});
}