import { useQuery } from "@tanstack/react-query";
import { useClasses } from "./use-classes";
import { classApi } from "../services/class.api";

export interface SubjectUsageEntry {
	classId: string;
	className: string;
	staffId: string | null;
	teacherName: string | null;
	classSubjectId: string | null;
	assignedVia: "manual" | "auto_subject_default" | "auto_homeroom" | null;
}

// N+1 — one request per class, since there's no dedicated
// GET /subjects/:id/usage endpoint yet. Fine at typical class counts;
// worth a real backend endpoint later if this page gets slow.
export function useSubjectUsage(subjectId: string, termId: string | undefined) {
	const { data: classes } = useClasses();

	return useQuery({
		queryKey: ["subjects", subjectId, "usage", termId],
		queryFn: async (): Promise<SubjectUsageEntry[]> => {
			if (!classes || !termId) return [];
			const results = await Promise.all(
				classes.map(async (cls) => {
					const res = await classApi.getClassSubjects(cls.id, termId);
					if (!res.success) return [];
					return res.data
						.filter((cs) => cs.subjectId === subjectId)
						.map((cs) => ({
							classId: cls.id,
							className: cls.name,
							staffId: cs.staffId,
							teacherName: cs.teacherName,
							classSubjectId: cs.classSubjectId,
							assignedVia: cs.assignedVia,
						}));
				})
			);
			return results.flat();
		},
		enabled: !!classes && classes.length > 0 && !!termId,
	});
}