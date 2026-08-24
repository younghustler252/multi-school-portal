import { PlanDistributionEntry } from "../types/super-admin.types";

const COLORS = ["bg-muted-foreground/30", "bg-info/70", "bg-primary", "bg-success/70"];

export function PlanDistributionChart({ plans }: { plans: PlanDistributionEntry[] }) {
	const total = plans.reduce((sum, p) => sum + p.schoolCount, 0);

	return (
		<ul className="space-y-3">
			{plans.map((p, i) => (
				<li key={p.planId}>
					<div className="mb-1 flex justify-between text-sm">
						<span>{p.planName}</span>
						<span className="text-muted-foreground">{p.schoolCount}</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className={COLORS[i % COLORS.length]}
							style={{ width: total > 0 ? `${(p.schoolCount / total) * 100}%` : "0%", height: "100%" }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}