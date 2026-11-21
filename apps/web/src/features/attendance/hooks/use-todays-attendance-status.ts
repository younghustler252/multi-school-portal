import { useClassRegister } from "./use-attendance";
import { todayInLagos } from "../lib/attendance";

/** Has anyone on this class's list been marked today? (Registers are per class and day; the term comes from the date.) */
export function useTodaysAttendanceStatus(classId: string) {
	const register = useClassRegister(classId, todayInLagos());
	const total = register.data?.students.length ?? 0;
	return {
		isLoading: register.isLoading,
		/** Everyone marked. */
		complete: !!register.data && total > 0 && register.data.summary.unmarked === 0,
		/** A holiday or other reason no register is expected today. */
		closed: !!register.data && !register.data.canMark && !register.data.students.some((s) => s.status),
		holiday: register.data?.holiday ?? null,
		isError: register.isError,
	};
}
