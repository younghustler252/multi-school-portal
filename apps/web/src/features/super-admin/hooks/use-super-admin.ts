import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superAdminApi } from "../services/super-admin.api";
import { ListUsersParams } from "../types/super-admin.types";

export function usePlatformStats() {
	return useQuery({
		queryKey: ["super-admin", "stats"],
		queryFn: async () => {
			const res = await superAdminApi.getStats();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function usePlatformUsers(params: ListUsersParams) {
	return useQuery({
		queryKey: ["super-admin", "users", params],
		queryFn: async () => {
			const res = await superAdminApi.listUsers(params);
			if (!res.success) throw res;
			return { users: res.data, meta: res.meta };
		},
	});
}

export function useDeactivatePlatformUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (userId: string) => {
			const res = await superAdminApi.deactivateUser(userId);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "users"] }),
	});
}

export function usePlatformMrrTrend(months = 6) {
	return useQuery({
		queryKey: ["super-admin", "mrr-trend", months],
		queryFn: async () => {
			const res = await superAdminApi.getMrrTrend(months);
			if (!res.success) throw res;
			return res.data;
		},
	});
}