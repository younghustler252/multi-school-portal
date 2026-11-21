import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceSummary } from "../hooks/use-attendance";
import { formatRate } from "../lib/attendance";

export function AttendanceSummaryCard({ studentId, termId }: { studentId: string; termId?: string }) {
	const { data: s, isLoading } = useAttendanceSummary(studentId, termId);

	if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
	if (!s) return null;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Attendance this term</h3>
			<div className="mt-3 flex items-baseline gap-2">
				<span className="text-2xl font-semibold">{formatRate(s.rate)}</span>
				{s.lowAttendance && <span className="text-xs text-destructive">Below 75%</span>}
			</div>
			<div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
				<div><div className="font-medium text-foreground">{s.present}</div>Present</div>
				<div><div className="font-medium text-foreground">{s.absent}</div>Absent</div>
				<div><div className="font-medium text-foreground">{s.late}</div>Late</div>
				<div><div className="font-medium text-foreground">{s.excused}</div>Excused</div>
			</div>
			<p className="mt-3 text-[11px] text-muted-foreground">
				{s.unmarked > 0 ? `${s.unmarked} of ${s.registerDays} register days have no mark. ` : ""}Excused days are not counted in the rate.
			</p>
		</div>
	);
}
