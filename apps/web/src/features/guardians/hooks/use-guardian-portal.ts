import { useQuery } from "@tanstack/react-query";
import { guardianPortalApi } from "../services/guardian-portal.api";
import { MyChildrenParams } from "../types/guardian-portal.types";

export function useMyChildren() {
	return useQuery({
		queryKey: ["guardian-portal", "children"],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildren();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenGrades(params: MyChildrenParams) {
	return useQuery({
		queryKey: ["guardian-portal", "grades", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenGrades(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenAttendance(params: MyChildrenParams) {
	return useQuery({
		queryKey: ["guardian-portal", "attendance", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenAttendance(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}
