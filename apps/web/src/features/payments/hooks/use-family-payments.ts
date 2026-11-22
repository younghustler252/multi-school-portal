import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { familyPaymentsApi } from "../services/family-payments.api";
import type { ListMyPaymentsParams } from "../types/payment-contract.types";

export function useFamilyPayments(params: ListMyPaymentsParams) {
	return useQuery({ queryKey: ["family-payments", "list", params], queryFn: () => familyPaymentsApi.list(params), placeholderData: keepPreviousData });
}

/** Loaded when the receipt is opened. */
export function useFamilyReceipt(paymentId: string | null) {
	return useQuery({ queryKey: ["family-payments", "receipt", paymentId], queryFn: () => familyPaymentsApi.receipt(paymentId as string), enabled: !!paymentId, retry: false });
}
