import { apiCall } from "@/lib/api/api-client";
import type {
	BillingSummary, ChangePlanResult, CheckoutStart, DowngradeResult, Invoice, InvoiceList, ListInvoicesParams,
	PaymentMethod, PlanChangeInput, PlanChangePreview, Subscription, VerifyPaymentResult,
} from "../types/billing.types";

/*
| School billing (docs/backend/modules/subscriptions.md). Reading needs billing.view, every change needs billing.manage.
| All calls throw ApiError; the codes callers react to: COUPON_INVALID, NO_PLAN_CHANGE, NOT_AN_UPGRADE, USE_DOWNGRADE,
| DOWNGRADE_BLOCKED, AUTO_RENEW_NEEDS_CARD, PAYMENT_UNAVAILABLE, INVOICE_NOT_PAYABLE.
*/
export const billingApi = {
	summary: () => apiCall<BillingSummary>({ method: "GET", url: "/subscriptions" }),

	preview: (data: PlanChangeInput) => apiCall<PlanChangePreview>({ method: "POST", url: "/subscriptions/preview", data }),

	/** Upgrade or billing-cycle change. The plan only changes once the payment is verified. */
	changePlan: (data: PlanChangeInput & { autoRenew?: boolean }) => apiCall<ChangePlanResult>({ method: "POST", url: "/subscriptions/change-plan", data }),

	verify: (reference: string) => apiCall<VerifyPaymentResult>({ method: "GET", url: "/subscriptions/verify", params: { reference } }),

	invoices: (params: ListInvoicesParams) => apiCall<InvoiceList>({ method: "GET", url: "/subscriptions/invoices", params }),

	invoice: (id: string) => apiCall<Invoice>({ method: "GET", url: `/subscriptions/invoices/${id}` }),

	payInvoice: (id: string, autoRenew = false) => apiCall<CheckoutStart>({ method: "POST", url: `/subscriptions/invoices/${id}/pay`, data: { autoRenew } }),

	requestDowngrade: (planId: string) => apiCall<DowngradeResult>({ method: "POST", url: "/subscriptions/downgrade", data: { planId } }),

	cancelDowngrade: () => apiCall<{ subscription: Subscription }>({ method: "DELETE", url: "/subscriptions/downgrade" }),

	cancel: (immediately: boolean) => apiCall<Subscription | null>({ method: "POST", url: "/subscriptions/cancel", data: { immediately } }),

	resume: () => apiCall<Subscription>({ method: "POST", url: "/subscriptions/resume" }),

	setAutoRenew: (enabled: boolean) => apiCall<Subscription>({ method: "PUT", url: "/subscriptions/auto-renew", data: { enabled } }),

	paymentMethods: () => apiCall<PaymentMethod[]>({ method: "GET", url: "/subscriptions/payment-methods" }),

	removePaymentMethod: (id: string) => apiCall<{ removed: true }>({ method: "DELETE", url: `/subscriptions/payment-methods/${id}` }),
};
