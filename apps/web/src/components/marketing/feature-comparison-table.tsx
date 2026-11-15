import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { comparisonGroups } from "@/features/plans/lib/plan-entitlements";
import type { PublicPlan } from "@/features/plans/types/plan.types";

/** "report_cards" / "report-cards" -> "Report cards": the API sends the module key, not a display name. */
function moduleTitle(module: string): string {
	const words = module.replace(/[-_.]+/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function FeatureComparisonTable({ plans }: { plans: PublicPlan[] }) {
	const groups = comparisonGroups(plans);
	if (groups.length === 0) return null;

	return (
		<div className="overflow-x-auto rounded-2xl border border-border bg-card/60">
			<table className="w-full min-w-[640px] text-sm">
				<thead>
					<tr className="border-b border-border">
						<th className="p-4 text-left font-medium text-muted-foreground">Feature</th>
						{plans.map((plan) => <th key={plan.id} className="p-4 text-left font-semibold">{plan.name}</th>)}
					</tr>
				</thead>
				<tbody>
					{groups.map((group) => (
						<Fragment key={group.module}>
							<tr className="bg-muted/40">
								<td colSpan={plans.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									{moduleTitle(group.module)}
								</td>
							</tr>
							{group.rows.map((row) => (
								<tr key={row.key} className="border-b border-border last:border-0">
									<td className="p-4 text-muted-foreground">{row.label}</td>
									{row.cells.map((cell, i) => (
										<td key={plans[i].id} className="p-4">
											{cell.kind === "included" && <Check className="size-4 text-primary" aria-label="Included" />}
											{cell.kind === "excluded" && <Minus className="size-4 text-muted-foreground/40" aria-label="Not included" />}
											{cell.kind === "text" && <span>{cell.text}</span>}
										</td>
									))}
								</tr>
							))}
						</Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
}
