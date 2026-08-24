import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentApi } from "../services/payment.api";
import { VerifyBankAccountParams } from "../types/payment.types";

export function useBanks() {
	return useQuery({
		queryKey: ["banks"],
		queryFn: async () => {
			const res = await paymentApi.listBanks();
			if (!res.success) throw res;
			return res.data;
		},
		staleTime: Infinity, // bank list basically never changes within a session
	});
}

export function useVerifyBankAccount() {
	return useMutation({
		mutationFn: async (params: VerifyBankAccountParams) => {
			const res = await paymentApi.verifyBankAccount(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}