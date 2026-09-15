import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionApi } from "../services/subscription.api";
import {
	UpgradePlanDto,
	CancelSubscriptionDto,
	VerifyTransactionResult,
	ToggleAutoRenewDto,
	ToggleAutoRenewResult,
	ListBillingHistoryParams
} from "../types/subscription.types";
import { ApiErrorResponse } from "@/types/api-response";

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
	return useMutation({
		mutationFn: async (data: UpgradePlanDto) => {
			const res = await subscriptionApi.upgrade(data);
			if (!res.success) throw res;
			return res.data;
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
export function useVerifyUpgrade() {
	const queryClient = useQueryClient();
	return useMutation<VerifyTransactionResult, ApiErrorResponse, string>({
		mutationFn: async (reference: string) => {
			const res = await subscriptionApi.verifyUpgrade(reference);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["subscription"] });
		},
	});
	
}

export function useToggleAutoRenew() {
	const queryClient = useQueryClient();
	return useMutation<ToggleAutoRenewResult, ApiErrorResponse, ToggleAutoRenewDto>({
		mutationFn: async (data) => {
			const res = await subscriptionApi.toggleAutoRenew(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscription"] }),
	});
}

export function useBillingHistory(params: ListBillingHistoryParams = {}) {
	return useQuery({
		queryKey: ["subscription", "billing-history", params],
		queryFn: async () => {
			const res = await subscriptionApi.getBillingHistory(params);

			if (!res.success) throw res;

			return {
				entries: res.data.data,
				meta: res.data.meta,
			};
		},
	});
}
