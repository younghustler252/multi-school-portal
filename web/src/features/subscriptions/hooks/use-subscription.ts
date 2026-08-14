import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionApi } from "../services/subscription.api";
import { UpgradePlanDto, CancelSubscriptionDto } from "../types/subscription.types";

export function useMySubscription() {
	return useQuery({
		queryKey: ["subscription", "me"],
		queryFn: async () => {
			const res = await subscriptionApi.getMySubscription();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useUpgradePlan() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpgradePlanDto) => {
			const res = await subscriptionApi.upgrade(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["subscription"] });
			queryClient.invalidateQueries({ queryKey: ["school", "dashboard"] });
		},
	});
}

export function useCancelSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CancelSubscriptionDto) => {
			const res = await subscriptionApi.cancel(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription"] }),
	});
}