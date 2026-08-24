import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolApi } from "@/features/school/services/school.api";
import { schoolManagementApi } from "../services/school-management.api";

// Reuses the same "my documents" endpoint shape, but for viewing any school's
// docs as super_admin — confirm the actual admin-facing list-documents route,
// since GET /schools/me/documents is self-service only (school_admin's own school).
export function useAdminSchoolDocuments(schoolId: string) {
	return useQuery({
		queryKey: ["super-admin", "schools", schoolId, "documents"],
		queryFn: async () => {
			const res = await schoolApi.getMyDocuments(); // placeholder — see flag below
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