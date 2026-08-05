import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClassResponseData } from "../types/class.types";

function inferCategory(level: string | null): string {
	if (!level) return "Unspecified";
	const lower = level.toLowerCase();
	if (lower.includes("primary")) return "Primary";
	if (lower.includes("jss")) return "Junior";
	if (lower.includes("sss")) return "Senior";
	return level;
}

export function ClassCard({ classItem }: { classItem: ClassResponseData }) {
	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm transition-colors hover:border-primary/40">
			<div className="flex items-start justify-between">
				<div>
					<div className="text-lg font-semibold">{classItem.name}</div>
					{classItem.capacity && (
						<div className="mt-0.5 text-xs text-muted-foreground">Capacity: {classItem.capacity} students</div>
					)}
				</div>
				<Badge variant="secondary">{inferCategory(classItem.level)}</Badge>
			</div>

			<div className="mt-5 flex items-end justify-between">
				<div className="text-xs text-muted-foreground">
					Student count coming soon — pending enrolment data.
				</div>
				<Button
					size="sm"
					variant="outline"
					nativeButton={false}
					render={<Link href={`/school-admin/classes/${classItem.id}`}>Manage</Link>}
				/>
			</div>
		</div>
	);
}