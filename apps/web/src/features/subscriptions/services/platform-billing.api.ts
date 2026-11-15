import { API, apiCall } from "@/lib/api/api-client";
import type {
	ExtendPeriodDto, ListPlatformInvoicesParams, ListPlatformSubscriptionsParams, MarkPaidDto, Paged, PlatformBillingStats,
	PlatformInvoice, PlatformPlanChangeDto, PlatformSubscription, SchoolBilling,
} from "../types/platform-billing.types";
import type { Subscription } from "../types/billing.types";

/*
| Platform billing (admin host, /platform/subscriptions): view = platform.subscriptions.view, every change =
| platform.subscriptions.manage. Lists are paged with `meta` beside `data`, so they use the envelope and throw on failure.
*/
async function paged<T>(url: string, params: object): Promise<Paged<T>> {
	const res = await API.get<T[]>(url, { params });
	if (!res.success) throw res;
	return { data: res.data, meta: res.meta! };
}

export const platformBillingApi = {
	list: (params: ListPlatformSubscriptionsParams) => paged<PlatformSubscription>("/platform/subscriptions", params),
	stats: () => apiCall<PlatformBillingStats>({ method: "GET", url: "/platform/subscriptions/stats" }),
	school: (schoolId: string) => apiCall<SchoolBilling>({ method: "GET", url: `/platform/subscriptions/${schoolId}` }),
	changePlan: (schoolId: string, data: PlatformPlanChangeDto) => apiCall<Subscription>({ method: "PUT", url: `/platform/subscriptions/${schoolId}/plan`, data }),
	extend: (schoolId: string, data: ExtendPeriodDto) => apiCall<Subscription>({ method: "PUT", url: `/platform/subscriptions/${schoolId}/extend`, data }),
	invoices: (params: ListPlatformInvoicesParams) => paged<PlatformInvoice>("/platform/subscriptions/invoices", params),
	voidInvoice: (id: string, reason: string) => apiCall<{ voided: true }>({ method: "PUT", url: `/platform/subscriptions/invoices/${id}/void`, data: { reason } }),
	markPaid: (id: string, data: MarkPaidDto) => apiCall<{ paid: true }>({ method: "PUT", url: `/platform/subscriptions/invoices/${id}/mark-paid`, data }),
};
