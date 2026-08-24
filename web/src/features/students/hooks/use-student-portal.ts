import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/features/students/services/student.api";
import { gradeApi } from "@/features/grades/services/grade.api";
import { attendanceApi } from "@/features/attendance/services/attendance.api";
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

export function useMyAttendance(termId?: string) {
	return useQuery({
		queryKey: ["student-portal", "attendance", termId],
		queryFn: async () => {
			const res = await attendanceApi.getMyAttendance({ termId });
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyInvoices(termId?: string) {
	return useQuery({
		queryKey: ["student-portal", "invoices", termId],
		queryFn: async () => {
			const res = await feeApi.getMyInvoices({ termId });
			if (!res.success) throw res;
			return res.data;
		},
	});
}