import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntitlement } from "@/features/plans/hooks/use-entitlement";
import type { ReactNode } from "react";
import { ROUTES } from "@/lib/routes";

interface FeatureGateProps {
	/** The plan feature key, e.g. "grading.custom" (the same keys the API enforces). */
	feature: string;
	featureName: string;
	children: ReactNode;
}

export function FeatureGate({ feature, featureName, children }: FeatureGateProps) {
	const { allowed, isLoading } = useEntitlement(feature);

	if (isLoading) return <Skeleton className="h-64 rounded-lg" />;

	// allowed === null: unknown (no billing access); show the feature, the API still enforces the plan.
	if (allowed === false) {
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
				<Button size="sm" render={<Link href={`${ROUTES.school.settings}?tab=billing`}>View plans</Link>} />
			</div>
		);
	}

	return <>{children}</>;
}