"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useMyAttendance, useMyAttendanceSummary } from "@/features/students/hooks/use-student-portal";
import { formatRate } from "@/features/attendance/lib/attendance";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/features/attendance/constants/attendance-status";

export default function StudentAttendancePage() {
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const { data: records, isLoading } = useMyAttendance(termId);

	const sorted = [...(records ?? [])].sort((a, b) => b.date.localeCompare(a.date));
	// The rate comes from the server: present and late count, excused days are left out.
	const { data: summary } = useMyAttendanceSummary(termId);

	return (
		<>
			<PageHeader title="My Attendance" description={summary && summary.rate !== null ? `${formatRate(summary.rate)} attendance this term` : undefined} />

			{isLoading && <Skeleton className="h-64 rounded-xl" />}

			{!isLoading && sorted.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					No attendance records yet.
				</div>
			)}

			{sorted.length > 0 && (
				<div className="space-y-2">
					{sorted.map((r) => (
						<div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm">
							<span className="text-muted-foreground">
								{new Date(`${r.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
							</span>
							<Badge variant="outline" className={ATTENDANCE_STATUS_COLORS[r.status]}>
								{ATTENDANCE_STATUS_LABELS[r.status]}
							</Badge>
						</div>
					))}
				</div>
			)}
		</>
	);
}