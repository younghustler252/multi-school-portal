import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolManagementApi } from "../services/school-management.api";
import { ListSchoolsParams } from "../types/school-management.types";

export function useAdminSchools(params: ListSchoolsParams) {
	return useQuery({
		queryKey: ["super-admin", "schools", params],
		queryFn: async () => {
			const res = await schoolManagementApi.list(params);
			if (!res.success) throw res;
			return { schools: res.data, meta: res.meta };
		},
	});
}

export function useAdminSchool(id: string) {
	return useQuery({
		queryKey: ["super-admin", "schools", id],
		queryFn: async () => {
			const res = await schoolManagementApi.getById(id);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!id,
	});
}
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

function useSchoolAction(action: (id: string, ...args: any[]) => Promise<any>) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (args: { id: string; reason?: string }) =>
			args.reason ? action(args.id, args.reason) : action(args.id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}
export function useVerifySchool() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => schoolManagementApi.verify(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}

export function useRejectSchool() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => schoolManagementApi.reject(id, reason),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}

export function useSuspendSchool() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, reason }: { id: string; reason: string }) => schoolManagementApi.suspend(id, reason),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}

export function useActivateSchool() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => schoolManagementApi.activate(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] }),
	});
}