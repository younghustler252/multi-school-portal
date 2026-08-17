"use client";

import { useMemo } from "react";
import { useMyChildrenAttendance } from "../hooks/use-guardian-portal";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildAttendanceCalendarProps {
	studentId: string;
	termId?: string;
}

const STATUS_CLASSES: Record<string, string> = {
	present: "bg-success/15 text-success",
	late: "bg-warning/30 text-warning-foreground",
	absent: "bg-destructive/20 text-destructive",
	excused: "bg-info/15 text-info",
};

export function ChildAttendanceCalendar({ studentId, termId }: ChildAttendanceCalendarProps) {
	const { data: records, isLoading } = useMyChildrenAttendance({ studentId, termId });

	const byDate = useMemo(() => {
	const map = new Map<string, string>();
		records?.forEach((r) => {
			const dateKey = r.date.slice(0, 10); // normalize to YYYY-MM-DD regardless of full ISO timestamp
			map.set(dateKey, r.status);
		});
		return map;
	}, [records]);
	
	const now = new Date();
	const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<div className="font-medium">Attendance calendar</div>
			<div className="mb-3 text-xs text-muted-foreground">{monthLabel}</div>

			<div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
				{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
				{Array.from({ length: daysInMonth }).map((_, i) => {
					const day = i + 1;
					const dateStr = new Date(now.getFullYear(), now.getMonth(), day).toISOString().slice(0, 10);
					const status = byDate.get(dateStr);
					const cls = status ? STATUS_CLASSES[status] : "bg-muted/40 text-muted-foreground";
					return (
						<div key={i} className={`grid aspect-square place-items-center rounded text-xs font-medium ${cls}`}>
							{day}
						</div>
					);
				})}
			</div>

			<div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
				<span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-success/40" /> Present</span>
				<span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-warning/40" /> Late</span>
				<span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-destructive/40" /> Absent</span>
			</div>
		</div>
	);
}