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