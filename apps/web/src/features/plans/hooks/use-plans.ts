import { useQuery } from "@tanstack/react-query";
import { plansApi } from "../services/plans.api";

export function usePlans() {
	return useQuery({
		queryKey: ["plans"],
		queryFn: async () => {
			const res = await plansApi.list();
			if (!res.success) {
				throw res;
			}
			return res.data;
		},
	});
}

/** Pricing page: the public plans in the shape the API returns today (entitlements, no studentLimit/features). */
export function usePublicPlans() {
	return useQuery({
		queryKey: ["plans", "public"],
		queryFn: async () => {
			const res = await plansApi.listPublic();
			if (!res.success) throw res;
			return res.data;
		},
	});
}
