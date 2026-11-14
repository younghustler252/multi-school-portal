import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../services/staff.api";
import type { CreateStaffDto, DeactivateStaffDto, ListStaffParams, SetStaffBranchesDto, UpdateStaffDto } from "../types/staff.types";
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
	return useQuery({ queryKey: ["staff", id], queryFn: () => staffApi.getById(id), enabled: !!id });
}

export function useCreateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateStaffDto) => staffApi.create(data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useUpdateStaff(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: UpdateStaffDto) => staffApi.update(id, data),
		onSuccess: (data) => {
			queryClient.setQueryData(["staff", id], data);
			queryClient.invalidateQueries({ queryKey: ["staff"], exact: false });
		},
	});
}

export function useDeactivateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...data }: { id: string } & DeactivateStaffDto) => staffApi.deactivate(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useReactivateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => staffApi.reactivate(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useSetStaffBranches(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: SetStaffBranchesDto) => staffApi.setBranches(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useChangeStaffRoles(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (roleIds: string[]) => staffApi.changeRoles(id, roleIds),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}

export function useInviteStaff(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (roleId: string) => staffApi.invite(id, roleId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
	});
}
