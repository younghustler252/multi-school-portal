import { useClasses } from "@/features/classes/hooks/use-classes";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { useAuthStore } from "@/stores/auth.store";

export interface ScopedClass {
	id: string;
	name: string;
}
export function useScopedClasses(): { classes: ScopedClass[]; isLoading: boolean } {
	const role = useAuthStore((s) => s.user?.role);
	const isTeacher = role === "teacher";

	const { data: allClasses, isLoading: allLoading } = useClasses();
	const { data: myClasses, isLoading: myLoading } = useMyClasses();

	if (isTeacher) {
		// Attendance is a class-teacher (homeroom) responsibility only —
		// a subject teacher for this class should not see it here, even
		// though they'd see it in useMyClasses().classesAsSubjectTeacher
		// for grading purposes.
		const classes = (myClasses?.classesAsClassTeacher ?? []).map((c) => ({
			id: c.classId,
			name: c.className,
		}));

		return {
			classes,
			isLoading: myLoading,
		};
	}

	return {
		classes: (allClasses ?? []).map((c) => ({
			id: c.id,
			name: c.name,
		})),
		isLoading: allLoading,
	};
}