import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../services/billing.api";
import type { ListInvoicesParams, PlanChangeInput } from "../types/billing.types";

const KEY = ["billing"] as const;

/** Billing summary. Needs billing.view, so pass `enabled` from the caller's permission check. */
export function useBillingSummary(enabled = true) {
	return useQuery({ queryKey: [...KEY, "summary"], queryFn: billingApi.summary, enabled });
}

export function useInvoices(params: ListInvoicesParams = {}, enabled = true) {
	return useQuery({ queryKey: [...KEY, "invoices", params], queryFn: () => billingApi.invoices(params), enabled });
}

/** A quote for a plan change; runs only while a plan is selected. A rejected change comes back as `error`. */
export function usePlanChangePreview(input: PlanChangeInput | null) {
	return useQuery({
		queryKey: [...KEY, "preview", input],
		queryFn: () => billingApi.preview(input!),
		enabled: input !== null,
		retry: false,
	});
}

function useBillingMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
	const queryClient = useQueryClient();
	return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) });
}

export const useChangePlan = () => useBillingMutation(billingApi.changePlan);
export const useVerifyPayment = () => useBillingMutation(billingApi.verify);
export const usePayInvoice = () => useBillingMutation(({ id, autoRenew }: { id: string; autoRenew?: boolean }) => billingApi.payInvoice(id, autoRenew));
export const useRequestDowngrade = () => useBillingMutation(billingApi.requestDowngrade);
export const useCancelDowngrade = () => useBillingMutation(billingApi.cancelDowngrade);
export const useCancelSubscription = () => useBillingMutation(billingApi.cancel);
export const useResumeSubscription = () => useBillingMutation(() => billingApi.resume());
export const useSetAutoRenew = () => useBillingMutation(billingApi.setAutoRenew);
export const useRemovePaymentMethod = () => useBillingMutation(billingApi.removePaymentMethod);
