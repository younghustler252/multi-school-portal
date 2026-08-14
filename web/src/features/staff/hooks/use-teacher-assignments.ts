import { useQuery } from "@tanstack/react-query";
import { staffApi } from "../services/staff.api";

export function useTeacherAssignments(staffId: string) {
	return useQuery({
		queryKey: ["staff", staffId, "assignments"],
		queryFn: async () => {
			const res = await staffApi.getAssignments(staffId);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!staffId,
	});
}