import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { familyFeesKeys } from "@/features/fees/hooks/use-family-fees";
import { onlinePaymentApi } from "../services/online-payment.api";
import type { InitializeOnlinePaymentDto } from "../types/payment-contract.types";

export function useInitializeOnlinePayment() {
	return useMutation({ mutationFn: (dto: InitializeOnlinePaymentDto) => onlinePaymentApi.initialize(dto) });
}

/*
| The return visit. While the gateway says "pending" it asks again every 4 s (at most 8 times, about half a minute);
| after that the person can press "Check again". A confirmed or already-confirmed answer refreshes balances, invoices,
| statements and the payment list.
*/
export function useVerifyOnlinePayment(reference: string | null) {
	const qc = useQueryClient();
	return useQuery({
		queryKey: ["family-payments", "verify", reference],
		enabled: !!reference,
		retry: false,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const result = await onlinePaymentApi.verify(reference as string);
			if (result.state === "confirmed" || result.state === "already") {
				qc.invalidateQueries({ queryKey: familyFeesKeys.all });
				qc.invalidateQueries({ queryKey: ["family-payments", "list"] });
			}
			return result;
		},
		refetchInterval: (query) => (query.state.data?.state === "pending" && query.state.dataUpdateCount < 8 ? 4000 : false),
	});
}
