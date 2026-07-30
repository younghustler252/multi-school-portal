import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolApi } from "../services/school.api";
import { UpdateSchoolDto } from "../types/school.types";

export function useMySchool() {
	return useQuery({
		queryKey: ["school", "me"],
		queryFn: async () => {
			const res = await schoolApi.getMySchool();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useSetupChecklist() {
	return useQuery({
		queryKey: ["school", "setup-checklist"],
		queryFn: async () => {
			const res = await schoolApi.getSetupChecklist();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useUpdateMySchool() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateSchoolDto) => {
			const res = await schoolApi.updateMySchool(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["school", "me"], data);
		},
	});
}

export function useSchoolDashboard() {
	return useQuery({
		queryKey: ["school", "dashboard"],
		queryFn: async () => {
			const res = await schoolApi.getDashboard();
			if (!res.success) throw res;
			return res.data;
		},
	});
}