import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformBillingApi } from "../services/platform-billing.api";
import type { ExtendPeriodDto, ListPlatformInvoicesParams, ListPlatformSubscriptionsParams, MarkPaidDto, PlatformPlanChangeDto } from "../types/platform-billing.types";

const KEY = ["platform-billing"] as const;

export const usePlatformSubscriptions = (params: ListPlatformSubscriptionsParams) =>
	useQuery({ queryKey: [...KEY, "list", params], queryFn: () => platformBillingApi.list(params), placeholderData: keepPreviousData });

export const usePlatformBillingStats = () => useQuery({ queryKey: [...KEY, "stats"], queryFn: platformBillingApi.stats });

export const usePlatformInvoices = (params: ListPlatformInvoicesParams) =>
	useQuery({ queryKey: [...KEY, "invoices", params], queryFn: () => platformBillingApi.invoices(params), placeholderData: keepPreviousData });

export const useSchoolBilling = (schoolId: string) =>
	useQuery({ queryKey: [...KEY, "school", schoolId], queryFn: () => platformBillingApi.school(schoolId), enabled: !!schoolId });

function useBillingAction<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: KEY });
			queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }); // the school pages show the plan name and MRR
		},
	});
}

export const usePlatformChangePlan = () => useBillingAction(({ schoolId, ...d }: { schoolId: string } & PlatformPlanChangeDto) => platformBillingApi.changePlan(schoolId, d));
export const useExtendPeriod = () => useBillingAction(({ schoolId, ...d }: { schoolId: string } & ExtendPeriodDto) => platformBillingApi.extend(schoolId, d));
export const useVoidInvoice = () => useBillingAction(({ id, reason }: { id: string; reason: string }) => platformBillingApi.voidInvoice(id, reason));
export const useMarkInvoicePaid = () => useBillingAction(({ id, ...d }: { id: string } & MarkPaidDto) => platformBillingApi.markPaid(id, d));
