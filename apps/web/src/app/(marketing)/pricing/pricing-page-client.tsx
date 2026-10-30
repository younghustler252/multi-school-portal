"use client";

import { useState } from "react";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { BillingToggle } from "@/components/marketing/billing-toggle";
import { PricingCard } from "@/components/marketing/pricing-card";
import { FeatureComparisonTable } from "@/components/marketing/feature-comparison-table";
import { Skeleton } from "@/components/ui/skeleton";

export function PricingPageClient() {
	const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
	const { data: plans, isLoading, isError } = usePlans();

	return (
		<div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
			<div className="text-center">
				<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
					Simple pricing, per school.
				</h1>
				<p className="mt-3 text-muted-foreground">
					Start free. Upgrade as your school grows.
				</p>
				<div className="mt-6 flex justify-center">
					<BillingToggle cycle={cycle} onChange={setCycle} />
				</div>
			</div>

			{isLoading && (
				<div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-80 rounded-2xl" />
					))}
				</div>
			)}

			{isError && (
				<p className="mt-12 text-center text-muted-foreground">
					Couldn&apos;t load plans right now — please try again shortly.
				</p>
			)}

			{plans && (
				<>
					<div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
						{plans.map((plan, i) => (
							<PricingCard
								key={plan.id}
								plan={plan}
								cycle={cycle}
								featured={i === plans.length - 2}
							/>
						))}
					</div>

					<div className="mt-16">
						<h2 className="text-xl font-semibold tracking-tight">Compare all features</h2>
						<div className="mt-6">
							<FeatureComparisonTable plans={plans} />
						</div>
					</div>
				</>
			)}
		</div>
	);
}