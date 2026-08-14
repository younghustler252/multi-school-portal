import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../services/attendance.api";
import { BulkMarkAttendanceDto, UpdateAttendanceDto, ListAttendanceParams } from "../types/attendance.types";

export function useAttendance(params: ListAttendanceParams) {
	return useQuery({
		queryKey: ["attendance", params],
		queryFn: async () => {
			const res = await attendanceApi.list(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useAttendanceSummary(studentId: string, termId?: string) {
	return useQuery({
		queryKey: ["attendance", "summary", studentId, termId],
		queryFn: async () => {
			const res = await attendanceApi.getSummary(studentId, termId);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!studentId,
	});
}

export function useBulkMarkAttendance() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: BulkMarkAttendanceDto) => {
			const res = await attendanceApi.bulkMark(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
	});
}

export function useUpdateAttendance() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: UpdateAttendanceDto }) => {
			const res = await attendanceApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
	});
}