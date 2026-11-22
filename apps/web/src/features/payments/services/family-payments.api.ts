import { API, apiCall } from "@/lib/api/api-client";
import type { PaginationMeta } from "@/types/api-response";
import type { FamilyPayment, FamilyReceipt, ListMyPaymentsParams } from "../types/payment-contract.types";

/*
| A GUARDIAN'S payments (payments.pay, OWN, guardian persona only: a student has no payments access).
|   GET /payments/my               what they paid, plus confirmed payments by others that cover their children (their share only)
|   GET /payments/my/:id/receipt   the frozen receipt, cut down to what this guardian may see; anything else is 404
*/
export const familyPaymentsApi = {
	list: async (params: ListMyPaymentsParams): Promise<{ data: FamilyPayment[]; meta: PaginationMeta }> => {
		const res = await API.get<FamilyPayment[]>("/payments/my", { params });
		if (!res.success) throw res;
		return { data: res.data, meta: res.meta! };
	},

	receipt: (paymentId: string): Promise<FamilyReceipt> => apiCall<FamilyReceipt>({ method: "GET", url: `/payments/my/${paymentId}/receipt` }),
};
