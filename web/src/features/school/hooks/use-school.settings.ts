import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolSettingsApi } from "../services/school-settings.api";
import { UpdateSchoolSettingsDto } from "../types/school-settings.types";

export function useSchoolSettings() {
	return useQuery({
		queryKey: ["school-settings"],
		queryFn: async () => {
			const res = await schoolSettingsApi.getSettings();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useUpdateSchoolSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateSchoolSettingsDto) => {
			const res = await schoolSettingsApi.updateSettings(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["school-settings"], data);
		},
	});
}