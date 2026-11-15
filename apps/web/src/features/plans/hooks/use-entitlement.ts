import { useAccess } from "@/lib/use-access";
import { useBillingSummary } from "@/features/subscriptions/hooks/use-billing";

/**
 * Whether the school's plan includes a feature, from the plan's entitlements.
 * `allowed` is null when this person can't read billing (billing.view) or the answer isn't known yet: the screen
 * should then just show the feature, because the API refuses the action itself (FEATURE_NOT_AVAILABLE) when the plan
 * lacks it. A key the plan doesn't list at all is a feature that isn't enforced yet, so it counts as allowed.
 */
export function useEntitlement(key: string): { allowed: boolean | null; isLoading: boolean } {
	const canView = useAccess().can("billing.view");
	const { data, isLoading } = useBillingSummary(canView);
	if (!canView) return { allowed: null, isLoading: false };
	if (isLoading) return { allowed: null, isLoading: true };
	const entitlement = data?.plan.entitlements.find((e) => e.key === key);
	if (!data || !entitlement) return { allowed: data ? true : null, isLoading: false };
	return { allowed: entitlement.granted && entitlement.value !== false, isLoading: false };
}
