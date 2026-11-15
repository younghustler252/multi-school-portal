import { useAccess } from "@/lib/use-access";
import { planIncludes } from "@/features/plans/lib/plan-entitlements";
import { useBillingSummary } from "@/features/subscriptions/hooks/use-billing";

/**
 * Whether the school's plan includes a feature, from the plan's entitlements.
 * `allowed` is null when this person can't read billing (billing.view) or the answer isn't known yet: the screen
 * should then just show the feature, because the API refuses the action itself (FEATURE_NOT_AVAILABLE) when the plan
 * lacks it. The plan summary lists only granted features, so a key it doesn't list is not included.
 */
export function useEntitlement(key: string): { allowed: boolean | null; isLoading: boolean } {
	const canView = useAccess().can("billing.view");
	const { data, isLoading } = useBillingSummary(canView);
	if (!canView) return { allowed: null, isLoading: false };
	if (isLoading || !data) return { allowed: null, isLoading };
	return { allowed: planIncludes(data.plan, key), isLoading: false };
}
