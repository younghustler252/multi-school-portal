import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "../services/payment.api";
import { ListPaymentsParams } from "../types/payment.types";

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
