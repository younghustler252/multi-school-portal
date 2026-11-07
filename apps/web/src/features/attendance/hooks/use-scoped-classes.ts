import { useClasses } from "@/features/classes/hooks/use-classes";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { useAccess } from "@/lib/use-access";

export interface ScopedClass {
	id: string;
	name: string;
}

/*
| Classes the person may take attendance for. The permission's scope decides, not a role name:
|   ALL / BRANCH  → every class the API returns
|   ASSIGNED / OWN → only the classes they are the class teacher of
| Attendance is a class-teacher (homeroom) responsibility at the narrow scopes; being a subject teacher does not count.
*/
export function useScopedClasses(): { classes: ScopedClass[]; isLoading: boolean } {
	const me = useAccess();
	const wide = me.canAtLeast("attendance.view", "BRANCH") || me.canAtLeast("attendance.mark", "BRANCH");

	const { data: allClasses, isLoading: allLoading } = useClasses();
	const { data: myClasses, isLoading: myLoading } = useMyClasses();

	if (!wide) {
		return {
			classes: (myClasses?.classesAsClassTeacher ?? []).map((c) => ({ id: c.classId, name: c.className })),
			isLoading: myLoading,
		};
	}

	return {
		classes: (allClasses ?? []).map((c) => ({ id: c.id, name: c.name })),
		isLoading: allLoading,
	};
}
