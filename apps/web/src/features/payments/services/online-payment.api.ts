import { apiCall } from "@/lib/api/api-client";
import type { InitializedOnlinePayment, InitializeOnlinePaymentDto, VerifiedOnlinePayment } from "../types/payment-contract.types";

/*
| Paying a child's invoice online (guardian only: payments.pay).
|   POST /payments/online/initialize        saves a PENDING payment, returns the gateway page to open (201)
|   GET  /payments/online/verify/:reference  the return visit: asks the gateway, confirms once, safe to repeat
| Errors (code → meaning): INVOICE_NOT_PAYABLE 409, NOT_YOUR_CHILD 403, GATEWAY_ERROR 502, PAYMENT_ACCOUNT_INVALID 400,
| NOT_YOUR_PAYMENT 403, ONLINE_AMOUNT_MISMATCH 409 (held for a person), 404 (unknown reference).
*/
export const onlinePaymentApi = {
	initialize: (dto: InitializeOnlinePaymentDto): Promise<InitializedOnlinePayment> =>
		apiCall<InitializedOnlinePayment>({ method: "POST", url: "/payments/online/initialize", data: dto }),

	verify: (reference: string): Promise<VerifiedOnlinePayment> =>
		apiCall<VerifiedOnlinePayment>({ method: "GET", url: `/payments/online/verify/${encodeURIComponent(reference)}` }),
};
