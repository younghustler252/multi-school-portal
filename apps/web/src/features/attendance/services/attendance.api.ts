import { API, apiCall } from "@/lib/api/api-client";
import type { PaginationMeta } from "@/types/api-response";
import type {
	AttendanceMark, ClassAttendanceSummary, ClassRegister, ListAttendanceParams, StudentAttendanceSummary, SubmitRegisterDto,
	SubmitRegisterResult, UpdateAttendanceDto,
} from "../types/attendance.types";

/*
| Attendance (docs/backend/modules/attendance.md). The list keeps the envelope for paging; the rest go through apiCall,
| which throws ApiError with the domain code (ATTENDANCE_HOLIDAY, ATTENDANCE_OUTSIDE_TERM, ...).
| Students and guardians read their own marks through the same list and summary (OWN scope), filtered by studentId.
*/
export const attendanceApi = {
	list: async (params: ListAttendanceParams): Promise<{ data: AttendanceMark[]; meta: PaginationMeta }> => {
		const res = await API.get<AttendanceMark[]>("/attendance", { params });
		if (!res.success) throw res;
		return { data: res.data, meta: res.meta! };
	},

	register: (classId: string, date: string): Promise<ClassRegister> =>
		apiCall<ClassRegister>({ method: "GET", url: `/attendance/classes/${classId}/register`, params: { date } }),

	submitRegister: (classId: string, data: SubmitRegisterDto): Promise<SubmitRegisterResult> =>
		apiCall<SubmitRegisterResult>({ method: "POST", url: `/attendance/classes/${classId}`, data }),

	update: (id: string, data: UpdateAttendanceDto): Promise<AttendanceMark> =>
		apiCall<AttendanceMark>({ method: "PUT", url: `/attendance/${id}`, data }),

	studentSummary: (studentId: string, termId?: string): Promise<StudentAttendanceSummary> =>
		apiCall<StudentAttendanceSummary>({ method: "GET", url: "/attendance/summary", params: { studentId, ...(termId ? { termId } : {}) } }),

	classSummary: (classId: string, termId?: string): Promise<ClassAttendanceSummary> =>
		apiCall<ClassAttendanceSummary>({ method: "GET", url: `/attendance/classes/${classId}/summary`, params: termId ? { termId } : {} }),
};
