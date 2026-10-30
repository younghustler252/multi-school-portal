import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentPlanFeatures } from "@/features/plans/hooks/use-current-plan-features";
import { PlanFeatures } from "@/features/plans/types/plan.types";
import type { ReactNode } from "react";

interface FeatureGateProps {
	feature: keyof PlanFeatures;
	featureName: string;
	children: ReactNode;
}

export function FeatureGate({ feature, featureName, children }: FeatureGateProps) {
	const { features, isLoading } = useCurrentPlanFeatures();

	if (isLoading) return <Skeleton className="h-64 rounded-lg" />;

	if (!features?.[feature]) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
				<div className="grid size-10 place-items-center rounded-full bg-muted">
					<Lock className="size-5 text-muted-foreground" />
				</div>
				<div>
					<p className="font-medium">{featureName} requires an upgrade</p>
					<p className="mt-1 text-sm text-muted-foreground">
						This feature isn&apos;t included in your current plan.
					</p>
				</div>
				<Button size="sm" render={<Link href="/school-admin/settings?tab=billing">View plans</Link>} />
			</div>
		);
	}

	return <>{children}</>;
}