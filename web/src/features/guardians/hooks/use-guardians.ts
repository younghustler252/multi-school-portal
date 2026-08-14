import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guardianApi } from "../services/guardian.api";
import { CreateGuardianDto, UpdateGuardianDto, LinkGuardianDto, ListGuardiansParams } from "../types/guardian.types";
import { PaginationMeta } from "@/types/api-response";

export function useGuardians(params: ListGuardiansParams) {
	return useQuery({
		queryKey: ["guardians", params],
		queryFn: async () => {
			const res = await guardianApi.list(params);
			if (!res.success) throw res;
			return { guardians: res.data, meta: res.meta as PaginationMeta };
		},
	});
}

export function useGuardian(id: string) {
	return useQuery({
		queryKey: ["guardians", id],
		queryFn: async () => {
			const res = await guardianApi.getById(id);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!id,
	});
}

export function useCreateGuardian() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateGuardianDto) => {
			const res = await guardianApi.create(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guardians"] }),
	});
}

export function useUpdateGuardian(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateGuardianDto) => {
			const res = await guardianApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["guardians", id], data);
			queryClient.invalidateQueries({ queryKey: ["guardians"], exact: false });
		},
	});
}

export function useInviteGuardian() {
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await guardianApi.invite(id);
			if (!res.success) throw res;
		},
	});
}

export function useLinkGuardian(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: LinkGuardianDto) => {
			const res = await guardianApi.link(id, data);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guardians"] }),
	});
}

export function useBulkInviteGuardians() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (guardianIds: string[]) => {
			const res = await guardianApi.bulkInvite(guardianIds);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guardians"] }),
	});
}