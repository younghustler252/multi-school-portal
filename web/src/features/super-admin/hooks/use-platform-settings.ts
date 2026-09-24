import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platformSettingsApi } from "../services/platform-settings.api";
import { UpdatePlatformSettingsDto } from "../types/platform-settings.types";

export function usePlatformSettings() {
	return useQuery({
		queryKey: ["platform-settings"],
		queryFn: async () => {
			const res = await platformSettingsApi.get();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useUpdatePlatformSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdatePlatformSettingsDto) => {
			const res = await platformSettingsApi.update(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-settings"] }),
	});
}   