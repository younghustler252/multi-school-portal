import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolApi } from "../services/school.api";


export function useMyDocuments() {
	return useQuery({
		queryKey: ["school", "documents"],
		queryFn: async () => {
			const res = await schoolApi.getMyDocuments();
			if (!res.success) throw res;
			return res.data;
		},
	});
}


