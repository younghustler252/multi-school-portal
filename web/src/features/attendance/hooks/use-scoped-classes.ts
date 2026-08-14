import { useClasses } from "@/features/classes/hooks/use-classes";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { useAuthStore } from "@/stores/auth.store";

export interface ScopedClass {
	id: string;
	name: string;
}

// Returns the classes a user is allowed to act on:
// - school_admin/principal: all classes
// - teacher: only their assigned classes
export function useScopedClasses(): { classes: ScopedClass[]; isLoading: boolean } {
	const role = useAuthStore((s) => s.user?.role);
	const isTeacher = role === "teacher";

	const { data: allClasses, isLoading: allLoading } = useClasses();
	const { data: myClasses, isLoading: myLoading } = useMyClasses();

	if (isTeacher) {
		return {
			classes: (myClasses ?? []).map((c) => ({ id: c.classId, name: c.className })),
			isLoading: myLoading,
		};
	}

	return {
		classes: (allClasses ?? []).map((c) => ({ id: c.id, name: c.name })),
		isLoading: allLoading,
	};
}