import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gradeApi } from "../services/grade.api";
import {
	BulkEnterGradesDto,
	UpdateGradeDto,
	PublishGradesDto,
	ListGradesParams,
	UpdateGradingConfigDto,
} from "../types/grade.types";

export function useGrades(params: ListGradesParams) {
	return useQuery({
		queryKey: ["grades", params],
		queryFn: async () => {
			const res = await gradeApi.list(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useBulkEnterGrades() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: BulkEnterGradesDto) => {
			const res = await gradeApi.bulkEnter(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grades"] }),
	});
}

export function useUpdateGrade() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: UpdateGradeDto }) => {
			const res = await gradeApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grades"] }),
	});
}

export function usePublishGrades() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: PublishGradesDto) => {
			const res = await gradeApi.publish(data);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grades"] }),
	});
}

export function useGradingConfig() {
	return useQuery({
		queryKey: ["grades", "config"],
		queryFn: async () => {
			const res = await gradeApi.getConfig();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useUpdateGradingConfig() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateGradingConfigDto) => {
			const res = await gradeApi.updateConfig(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grades", "config"] }),
	});
}