import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/features/students/services/student.api";
import { gradeApi } from "@/features/grades/services/grade.api";
import { attendanceApi } from "@/features/attendance/services/attendance.api";
import { useAttendanceSummary } from "@/features/attendance/hooks/use-attendance";
import { feeApi } from "@/features/fees/services/fee.api";

export function useMyStudentProfile() {
	return useQuery({
		queryKey: ["student-portal", "me"],
		queryFn: async () => {
			const res = await studentApi.getMe();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyGrades(termId?: string) {
	return useQuery({
		queryKey: ["student-portal", "grades", termId],
		queryFn: async () => {
			const res = await gradeApi.getMyGrades({ termId });
			if (!res.success) throw res;
			return res.data;
		},
	});
}

/*
| A student reads their own attendance through the normal list and summary (OWN scope), filtered by their own id from
| GET /students/me. There is no /attendance/me. The term defaults to the current one for the summary.
*/
export function useMyAttendance(termId?: string) {
	const { data: me } = useMyStudentProfile();
	const studentId = me?.id ?? "";
	return useQuery({
		queryKey: ["student-portal", "attendance", studentId, termId],
		queryFn: async () => (await attendanceApi.list({ studentId, termId, limit: 100 })).data,
		enabled: !!studentId,
	});
}

export function useMyAttendanceSummary(termId?: string) {
	const { data: me } = useMyStudentProfile();
	return useAttendanceSummary(me?.id ?? "", termId);
}

export function useMyInvoices(termId?: string) {
	return useQuery({
		queryKey: ["student-portal", "invoices", termId],
		queryFn: async () => {
			const res = await feeApi.getMyInvoices();
			if (!res.success) throw res;
			// The API lists all of the student's invoices; the term filter is applied here.
			return termId ? res.data.filter((i) => i.termId === termId) : res.data;
		},
	});
}