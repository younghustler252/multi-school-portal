import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolApi } from "@/features/school/services/school.api";
import { schoolManagementApi } from "../services/school-management.api";

export function useAdminSchoolDocuments(schoolId: string) {
	return useQuery({
		queryKey: ["super-admin", "schools", schoolId, "documents"],
		queryFn: async () => {
			const res = await schoolManagementApi.getSchoolDocuments(schoolId);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!schoolId,
	});
}

export function useApproveDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (documentId: string) => schoolManagementApi.approveDocument(documentId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}

export function useRejectDocument() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ documentId, reason }: { documentId: string; reason: string }) =>
			schoolManagementApi.rejectDocument(documentId, reason),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}