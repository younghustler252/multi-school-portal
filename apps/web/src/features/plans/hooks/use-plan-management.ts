import { useMutation, useQueryClient } from "@tanstack/react-query";
import { planManagementApi } from "../services/plan-management.api";
import { CreatePlanDto, UpdatePlanDto } from "../types/plan-management.types";

export function useCreatePlan() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreatePlanDto) => planManagementApi.create(data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
	});
}

export function useUpdatePlan(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: UpdatePlanDto) => planManagementApi.update(id, data),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
	});
}