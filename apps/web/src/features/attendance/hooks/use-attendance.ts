import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../services/attendance.api";
import type { ListAttendanceParams, SubmitRegisterDto, UpdateAttendanceDto } from "../types/attendance.types";

/** Marks, narrowed by the filters and by what the viewer may see. Students and guardians pass their own studentId. */
export function useAttendanceMarks(params: ListAttendanceParams, enabled = true) {
	return useQuery({ queryKey: ["attendance", "list", params], queryFn: () => attendanceApi.list(params), enabled, placeholderData: keepPreviousData });
}

export function useAttendanceSummary(studentId: string, termId?: string) {
	return useQuery({ queryKey: ["attendance", "summary", studentId, termId], queryFn: () => attendanceApi.studentSummary(studentId, termId), enabled: !!studentId });
}

/** One summary per child (the guardian home shows each child's rate). */
export function useAttendanceSummaries(studentIds: string[], termId?: string) {
	return useQueries({
		queries: studentIds.map((id) => ({ queryKey: ["attendance", "summary", id, termId], queryFn: () => attendanceApi.studentSummary(id, termId) })),
	});
}

export function useClassAttendanceSummary(classId: string, termId?: string) {
	return useQuery({ queryKey: ["attendance", "class-summary", classId, termId], queryFn: () => attendanceApi.classSummary(classId, termId), enabled: !!classId });
}

/** A class's register for one day (who is on the list and what they were marked). The term comes from the date. */
export function useClassRegister(classId: string, date: string) {
	return useQuery({ queryKey: ["attendance", "register", classId, date], queryFn: () => attendanceApi.register(classId, date), enabled: !!classId && !!date, retry: false });
}

export function useSubmitRegister(classId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: SubmitRegisterDto) => attendanceApi.submitRegister(classId, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
	});
}

export function useUpdateAttendanceMark() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateAttendanceDto }) => attendanceApi.update(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
	});
}
