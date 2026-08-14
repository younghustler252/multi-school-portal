import { useMySubscription } from "@/features/subscriptions/hooks/use-subscription";
import { usePlans } from "./use-plans";
import { PlanFeatures } from "../types/plan.types";

export function useCurrentPlanFeatures(): {
	features: PlanFeatures | null;
	isLoading: boolean;
} {
	const { data: subData, isLoading: subLoading } = useMySubscription();
	const { data: plans, isLoading: plansLoading } = usePlans();

	const currentPlan = plans?.find((p) => p.id === subData?.subscription.planId);

	return {
		features: currentPlan?.features ?? null,
		isLoading: subLoading || plansLoading,
	};
}