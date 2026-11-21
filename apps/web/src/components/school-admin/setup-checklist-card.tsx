import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { SetupChecklist } from "@/features/school/types/school.types";

export function SetupChecklistCard({ checklist }: { checklist: SetupChecklist }) {
	const items = Object.entries(checklist).filter(([key]) => key !== "completionPercent") as [
		string,
		{ completed: boolean; label: string },
	][];
	const done = items.filter(([, item]) => item.completed).length;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-section">Get your school set up</CardTitle>
				<CardDescription>{done} of {items.length} steps done</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<Meter percent={checklist.completionPercent} label="Setup progress" valueText={`${checklist.completionPercent}% complete`} />

				<ul className="space-y-2.5">
					{items.map(([key, item]) => (
						<li key={key} className="flex items-center gap-2.5 text-sm">
							{item.completed ? (
								<Check className="size-4 shrink-0 text-primary" aria-label="Done" />
							) : (
								<Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="Not done" />
							)}
							<span className={item.completed ? "text-muted-foreground line-through" : ""}>{item.label}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
