import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enrolmentApi } from "../services/enrolment.api";
import { EnrolStudentDto, BulkEnrolDto, UpdateEnrolmentDto, ListEnrolmentsParams } from "../types/enrolment.types";
import { PaginationMeta } from "@/types/api-response";

export function useEnrolments(params: ListEnrolmentsParams) {
	return useQuery({
		queryKey: ["enrolments", params],
		queryFn: async () => {
			const res = await enrolmentApi.list(params);
			if (!res.success) throw res;
			return { enrolments: res.data, meta: res.meta as PaginationMeta | undefined };
		},
	});
}

export function useEnrolStudent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: EnrolStudentDto) => {
			const res = await enrolmentApi.enrol(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrolments"] }),
	});
}

export function useBulkEnrol() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: BulkEnrolDto) => {
			const res = await enrolmentApi.bulkEnrol(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrolments"] }),
	});
}

export function useUpdateEnrolmentStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: UpdateEnrolmentDto }) => {
			const res = await enrolmentApi.updateStatus(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrolments"] }),
	});
}