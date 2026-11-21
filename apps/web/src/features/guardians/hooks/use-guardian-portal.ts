import { useQuery } from "@tanstack/react-query";
import { useAttendanceMarks } from "@/features/attendance/hooks/use-attendance";
import { guardianPortalApi } from "../services/guardian-portal.api";
import { MyChildrenParams, MyChildrenInvoicesParams } from "../types/guardian-portal.types";

export function useMyChildren() {
	return useQuery({
		queryKey: ["guardian-portal", "children"],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildren();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenGrades(params: MyChildrenParams) {
	return useQuery({
		queryKey: ["guardian-portal", "grades", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenGrades(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

/*
| A guardian reads a linked child's marks through the normal attendance list (OWN scope): GET /attendance?studentId=.
| One child at a time; the list is capped at 100 marks, enough for a term of school days.
*/
export function useChildAttendance(studentId: string, termId?: string) {
	return useAttendanceMarks({ studentId, termId, limit: 100 }, !!studentId);
}

export function useMyChildrenInvoices(params: MyChildrenInvoicesParams) {
	return useQuery({
		queryKey: ["guardian-portal", "invoices", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenInvoices(params);
			if (!res.success) throw res;
			return { invoices: res.data, meta: res.meta };
		},
	});
}