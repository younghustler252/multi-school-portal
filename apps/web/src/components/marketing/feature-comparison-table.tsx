import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { FEATURE_GROUPS } from "@/features/plans/components/feature-groups";
import { PlanResponseData } from "@/features/plans/types/plan.types";

export function FeatureComparisonTable({ plans }: { plans: PlanResponseData[] }) {
	return (
		<div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
			<table className="w-full min-w-[640px] text-sm">
				<thead>
					<tr className="border-b border-border">
						<th className="p-4 text-left font-medium text-muted-foreground">Feature</th>
						{plans.map((plan) => (
							<th key={plan.id} className="p-4 text-left font-semibold">
								{plan.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{FEATURE_GROUPS.map((group) => (
						<Fragment key={group.label}>
							<tr className="bg-muted/40">
								<td
									colSpan={plans.length + 1}
									className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
								>
									{group.label}
								</td>
							</tr>
							{group.rows.map((row) => (
								<tr key={row.key} className="border-b border-border last:border-0">
									<td className="p-4 text-muted-foreground">{row.label}</td>
									{plans.map((plan) => {
										const enabled = Boolean(plan.features[row.key]);
										return (
											<td key={plan.id} className="p-4">
												{enabled ? (
													<Check className="size-4 text-primary" />
												) : (
													<Minus className="size-4 text-muted-foreground/40" />
												)}
											</td>
										);
									})}
								</tr>
							))}
						</Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
}