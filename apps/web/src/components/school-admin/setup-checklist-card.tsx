import { Check, Circle } from "lucide-react";
import { SetupChecklist } from "@/features/school/types/school.types";

export function SetupChecklistCard({ checklist }: { checklist: SetupChecklist }) {
	const items = Object.entries(checklist).filter(([key]) => key !== "completionPercent") as [
		string,
		{ completed: boolean; label: string },
	][];

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<div className="flex items-center justify-between">
				<h3 className="font-medium">Get your school set up</h3>
				<span className="text-sm text-muted-foreground">{checklist.completionPercent}%</span>
			</div>

			<div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-primary transition-all"
					style={{ width: `${checklist.completionPercent}%` }}
				/>
			</div>

			<ul className="mt-4 space-y-2.5">
				{items.map(([key, item]) => (
					<li key={key} className="flex items-center gap-2.5 text-sm">
						{item.completed ? (
							<Check className="size-4 shrink-0 text-primary" />
						) : (
							<Circle className="size-4 shrink-0 text-muted-foreground/40" />
						)}
						<span className={item.completed ? "text-muted-foreground line-through" : ""}>
							{item.label}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}