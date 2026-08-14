import { useAttendanceSummary } from "../hooks/use-attendance";
import { Skeleton } from "@/components/ui/skeleton";

export function AttendanceSummaryCard({ studentId, termId }: { studentId: string; termId?: string }) {
	const { data: summary, isLoading } = useAttendanceSummary(studentId, termId);

	if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
	if (!summary) return null;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Attendance this term</h3>
			<div className="mt-3 text-2xl font-semibold">{summary.percentage}%</div>
			<div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
				<div><div className="font-medium text-foreground">{summary.present}</div>Present</div>
				<div><div className="font-medium text-foreground">{summary.absent}</div>Absent</div>
				<div><div className="font-medium text-foreground">{summary.late}</div>Late</div>
				<div><div className="font-medium text-foreground">{summary.excused}</div>Excused</div>
			</div>
		</div>
	);
}