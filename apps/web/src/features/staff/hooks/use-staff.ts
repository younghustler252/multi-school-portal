import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../services/staff.api";
import { CreateStaffDto, UpdateStaffDto, ListStaffParams } from "../types/staff.types";
import { PaginationMeta } from "@/types/api-response";

export function useStaffList(params: ListStaffParams) {
	return useQuery({
		queryKey: ["staff", params],
		queryFn: async () => {
			const res = await staffApi.list(params);
			if (!res.success) throw res;
			return { staff: res.data, meta: res.meta as PaginationMeta };
		},
	});
}

export function useStaffMember(id: string) {
	return useQuery({
		queryKey: ["staff", id],
		queryFn: async () => {
			const res = await staffApi.getById(id);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!id,
	});
}

export function useCreateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateStaffDto) => {
			const res = await staffApi.create(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useUpdateStaff(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateStaffDto) => {
			const res = await staffApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["staff", id], data);
			queryClient.invalidateQueries({ queryKey: ["staff"], exact: false });
		},
	});
}

export function useDeactivateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await staffApi.deactivate(id);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useReactivateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await staffApi.reactivate(id);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}