import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../services/attendance.api";

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

// Checks whether attendance has been marked today for a given class
export function useTodaysAttendanceStatus(classId: string, termId?: string) {
	return useQuery({
		queryKey: ["attendance", "today-status", classId, termId],
		queryFn: async () => {
			const res = await attendanceApi.list({ classId, termId, date: todayISO(), limit: 1 });
			if (!res.success) return false;
			return res.data.length > 0;
		},
		enabled: !!classId && !!termId,
	});
}