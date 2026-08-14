"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { useMySubscription } from "@/features/subscriptions/hooks/use-subscription";
import { UpgradePlanDialog } from "@/features/subscriptions/components/upgrade-plan-dialog";
import { SettingsSection } from "./settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format-money";

export function BillingTab() {
	const { data: plans, isLoading: plansLoading } = usePlans();
	const { data: subData, isLoading: subLoading } = useMySubscription();
	const [upgradeOpen, setUpgradeOpen] = useState(false);

	return (
		<>
			<SettingsSection title="Current plan">
				{subLoading ? (
					<Skeleton className="h-16 rounded-lg" />
				) : subData ? (
					<div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<div className="flex items-center gap-2">
								<span className="font-semibold">{subData.plan.name} plan</span>
								<Badge>{subData.subscription.status}</Badge>
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								Billed {subData.subscription.billingCycle}
								{subData.subscription.nextBillingDate &&
									` · Next billing ${new Date(subData.subscription.nextBillingDate).toLocaleDateString()}`}
							</div>
						</div>
						<Button size="sm" variant="outline" onClick={() => setUpgradeOpen(true)}>
							Change plan
						</Button>
					</div>
				) : null}
			</SettingsSection>

			<SettingsSection title="Available plans" description="Compare plans below, or use Change plan above to switch.">
				{plansLoading ? (
					<div className="grid gap-4 md:grid-cols-3">
						<Skeleton className="h-64 rounded-xl" />
						<Skeleton className="h-64 rounded-xl" />
						<Skeleton className="h-64 rounded-xl" />
					</div>
				) : plans ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{plans.map((plan) => {
							const isCurrent = plan.id === subData?.subscription.planId;
							return (
								<div
									key={plan.id}
									className={`rounded-xl border p-4 ${
										isCurrent ? "border-primary bg-primary/5" : "border-border bg-card"
									}`}
								>
									<div className="flex items-start justify-between">
										<span className="font-semibold">{plan.name}</span>
										{isCurrent && <Badge>Current</Badge>}
									</div>
									<div className="mt-2 text-xl font-semibold">
										{plan.monthlyPriceKobo === 0 ? "₦0" : formatNaira(plan.monthlyPriceKobo)}
										<span className="text-xs font-normal text-muted-foreground">/mo</span>
									</div>
									<div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
										<Check className="size-3 text-primary" /> {plan.studentLimit === -1 ? "Unlimited" : plan.studentLimit} students
									</div>
								</div>
							);
						})}
					</div>
				) : null}
			</SettingsSection>

			{subData && (
				<UpgradePlanDialog
					currentPlanId={subData.subscription.planId}
					open={upgradeOpen}
					onOpenChange={setUpgradeOpen}
				/>
			)}
		</>
	);
}