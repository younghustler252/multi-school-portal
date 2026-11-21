import { useClasses } from "@/features/classes/hooks/use-classes";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { useAccess } from "@/lib/use-access";
import { mergeTeachingClasses } from "../lib/attendance";

export interface ScopedClass {
	id: string;
	name: string;
}

/*
| Classes the person may take attendance for. The permission's scope decides, not a role name:
|   ALL / BRANCH  → every class the API returns
|   ASSIGNED / OWN → the classes they lead plus the classes they teach a subject in (ASSIGNED covers both, per the backend)
| The server still decides: a class the person cannot mark comes back with canMark=false on its register.
*/
export function useScopedClasses(): { classes: ScopedClass[]; isLoading: boolean } {
	const me = useAccess();
	const wide = me.canAtLeast("attendance.view", "BRANCH") || me.canAtLeast("attendance.mark", "BRANCH");

	const { data: allClasses, isLoading: allLoading } = useClasses();
	const { data: myClasses, isLoading: myLoading } = useMyClasses();

	if (!wide) {
		return {
			classes: mergeTeachingClasses(myClasses?.classesAsClassTeacher, myClasses?.classesAsSubjectTeacher),
			isLoading: myLoading,
		};
	}

	return {
		classes: (allClasses ?? []).map((c) => ({ id: c.id, name: c.name })),
		isLoading: allLoading,
	};
}
