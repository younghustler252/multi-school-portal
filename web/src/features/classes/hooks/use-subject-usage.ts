import { useQuery } from "@tanstack/react-query";
import { useClasses } from "./use-classes";
import { classApi } from "../services/class.api";

export interface SubjectUsageEntry {
	classId: string;
	className: string;
	teacherId: string;
	classSubjectId: string;
}

export function useSubjectUsage(subjectId: string) {
	const { data: classes } = useClasses();

	return useQuery({
		queryKey: ["subjects", subjectId, "usage"],
		queryFn: async (): Promise<SubjectUsageEntry[]> => {
			if (!classes) return [];
			const results = await Promise.all(
				classes.map(async (cls) => {
					const res = await classApi.getClassSubjects(cls.id);
					if (!res.success) return [];
					return res.data
						.filter((cs) => cs.subjectId === subjectId)
						.map((cs) => ({
							classId: cls.id,
							className: cls.name,
							teacherId: cs.staffId,
							classSubjectId: cs.id,
						}));
				})
			);
			return results.flat();
		},
		enabled: !!classes && classes.length > 0,
	});
}