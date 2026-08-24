import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentApi } from "../services/payment.api";
import { InitializePaymentDto, ListPaymentsParams } from "../types/payment.types";

export function usePayments(params: ListPaymentsParams) {
	return useQuery({
		queryKey: ["payments", params],
		queryFn: async () => {
			const res = await paymentApi.list(params);
			if (!res.success) throw res;
			return { payments: res.data, meta: res.meta };
		},
	});
}

export function useInitializePayment() {
	return useMutation({
		mutationFn: async (data: InitializePaymentDto) => {
			const res = await paymentApi.initialize(data);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useVerifyPayment(reference: string | null) {
	return useQuery({
		queryKey: ["payments", "verify", reference],
		queryFn: async () => {
			if (!reference) throw new Error("No reference");
			const res = await paymentApi.verify(reference);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!reference,
	});
}


export function useMyPayments(params: ListPaymentsParams) {
	return useQuery({
		queryKey: ["payments", "my-payments", params],
		queryFn: async () => {
			const res = await paymentApi.getMyPayments(params);
			if (!res.success) throw res;
			return { payments: res.data, meta: res.meta };
		},
	});
}