import { useQuery } from "@tanstack/react-query";
import { staffApi } from "../services/staff.api";


export function useMyClasses() {
	return useQuery({
		queryKey: ["staff", "me", "classes"],
		queryFn: async () => {
			const res = await staffApi.getMyClasses();
			if (!res.success) throw res;
			return res.data; // { classesAsClassTeacher, classesAsSubjectTeacher }
		},
	});
}