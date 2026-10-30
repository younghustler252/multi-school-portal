import { useQuery } from "@tanstack/react-query";
import { enrolmentApi } from "../services/enrolment.api";

export function useStudentCurrentEnrolment(studentId: string, termId?: string) {
	return useQuery({
		queryKey: ["enrolments", "student", studentId, termId],
		queryFn: async () => {
			const res = await enrolmentApi.list({ studentId, termId, status: "active", limit: 1 });
			if (!res.success) throw res;
			return res.data[0] ?? null;
		},
		enabled: !!studentId && !!termId,
	});
}