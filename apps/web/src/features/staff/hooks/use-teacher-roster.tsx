import { useQuery } from "@tanstack/react-query";
import { useTeacherAssignments } from "./use-teacher-assignments";
import { enrolmentApi } from "@/features/enrolment/services/enrolment.api";
import { studentApi } from "@/features/students/services/student.api";

export interface RosterEntry {
	studentId: string;
	studentName: string;
	admissionNumber: string | null;
	className: string;
}

export function useTeacherRoster(staffId: string, termId?: string) {
	const { data: assignments } = useTeacherAssignments(staffId);
	const classIds = [...new Set(assignments?.map((a) => a.classId) ?? [])];

	return useQuery({
		queryKey: ["staff", staffId, "roster", termId, classIds],
		queryFn: async (): Promise<RosterEntry[]> => {
			if (classIds.length === 0) return [];

			const enrolmentsByClass = await Promise.all(
				classIds.map((classId) =>
					enrolmentApi.list({ classId, termId, status: "active", limit: 200 })
				)
			);

			const studentIds = new Set<string>();
			const classNameByStudent = new Map<string, string>();

			enrolmentsByClass.forEach((res, i) => {
				if (!res.success) return;
				const className = assignments?.find((a) => a.classId === classIds[i])?.className ?? "";
				res.data.forEach((e) => {
					studentIds.add(e.studentId);
					classNameByStudent.set(e.studentId, className);
				});
			});

			if (studentIds.size === 0) return [];

			const studentsRes = await studentApi.list({ limit: 500 });
			if (!studentsRes.success) return [];

			return studentsRes.data
				.filter((s) => studentIds.has(s.id))
				.map((s) => ({
					studentId: s.id,
					studentName: `${s.firstName} ${s.lastName}`,
					admissionNumber: s.admissionNumber,
					className: classNameByStudent.get(s.id) ?? "",
				}));
		},
		enabled: !!assignments && classIds.length > 0,
	});
}