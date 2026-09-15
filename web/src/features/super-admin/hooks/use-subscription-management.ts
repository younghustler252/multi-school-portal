import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionManagementApi } from "../services/subscription-management.api";
import { ListSubscriptionsParams } from "../types/subscription-management.types";

export function useAdminSubscriptions(params: ListSubscriptionsParams) {
	return useQuery({
		queryKey: ["super-admin", "subscriptions", params],
		queryFn: async () => {
			const res = await subscriptionManagementApi.list(params);
			if (!res.success) throw res;
			return { subscriptions: res.data, meta: res.meta };
		},
	});
}

export function useSubscriptionStats() {
	return useQuery({
		queryKey: ["super-admin", "subscriptions", "stats"],
		queryFn: async () => {
			const res = await subscriptionManagementApi.getStats();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useDeactivateSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => subscriptionManagementApi.deactivate(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "subscriptions"] }),
	});
}