import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planAdminApi } from "../services/plan-admin.api";
import type { ClonePlanDto, CreatePlanDto, EntitlementChange, UpdatePlanDto } from "../types/plan-admin.types";

const KEY = ["plans", "admin"] as const;

export const useAdminPlans = (enabled = true) => useQuery({ queryKey: [...KEY, "list"], queryFn: planAdminApi.list, enabled });
export const useAdminPlan = (id: string | null) => useQuery({ queryKey: [...KEY, "one", id], queryFn: () => planAdminApi.get(id!), enabled: !!id });

function useAdminMutation<TArgs, TResult>(fn: (a: TArgs) => Promise<TResult>) {
	const queryClient = useQueryClient();
	// Plans also feed the public pricing page, billing and the school pages, so every plan query is refreshed.
	return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }) });
}

export const useCreatePlan = () => useAdminMutation((d: CreatePlanDto) => planAdminApi.create(d));
export const useUpdatePlan = () => useAdminMutation(({ id, ...d }: { id: string } & UpdatePlanDto) => planAdminApi.update(id, d));
export const useSetEntitlements = () => useAdminMutation(({ id, changes }: { id: string; changes: EntitlementChange[] }) => planAdminApi.setEntitlements(id, changes));
export const useDeactivatePlan = () => useAdminMutation((id: string) => planAdminApi.deactivate(id));
export const useReactivatePlan = () => useAdminMutation((id: string) => planAdminApi.reactivate(id));
export const useClonePlan = () => useAdminMutation(({ id, ...d }: { id: string } & ClonePlanDto) => planAdminApi.clone(id, d));
