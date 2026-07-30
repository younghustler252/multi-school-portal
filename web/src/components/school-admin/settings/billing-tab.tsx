"use client";

import { Check } from "lucide-react";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { useSchoolDashboard } from "@/features/school/hooks/use-school";
import { SettingsSection } from "./settings-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/format-money";

export function BillingTab() {
	const { data: plans, isLoading: plansLoading } = usePlans();
	const { data: dashboard, isLoading: dashboardLoading } = useSchoolDashboard();

	return (
		<>
			<SettingsSection title="Current plan">
				{dashboardLoading ? (
					<Skeleton className="h-16 rounded-lg" />
				) : dashboard ? (
					<div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-4">
						<div>
							<div className="flex items-center gap-2">
								<span className="font-semibold">{dashboard.plan.name} plan</span>
								<Badge>{dashboard.plan.status}</Badge>
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								{dashboard.people.totalStudents}/{dashboard.plan.studentLimit} students ·{" "}
								{dashboard.people.totalStaff}/{dashboard.plan.staffLimit} staff
							</div>
						</div>
					</div>
				) : null}
			</SettingsSection>

			<SettingsSection title="Available plans" description="Upgrade or downgrade anytime.">
				{plansLoading ? (
					<div className="grid gap-4 md:grid-cols-3">
						<Skeleton className="h-64 rounded-xl" />
						<Skeleton className="h-64 rounded-xl" />
						<Skeleton className="h-64 rounded-xl" />
					</div>
				) : plans ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{plans.map((plan) => {
							const isCurrent = plan.name === dashboard?.plan.name;
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
		</>
	);
}