import { cn } from "@/lib/utils";
import { AttendanceStatus } from "../types/attendance.types";
import { ATTENDANCE_STATUS_LABELS } from "../constants/attendance-status";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const ACTIVE_CLASSES: Record<AttendanceStatus, string> = {
	present: "border-success bg-success/15 text-success",
	absent: "border-destructive bg-destructive/15 text-destructive",
	late: "border-warning bg-warning/20 text-warning-foreground",
	excused: "border-info bg-info/15 text-info",
};

interface StatusPickerProps {
	value: AttendanceStatus;
	onChange: (status: AttendanceStatus) => void;
}

export function StatusPicker({ value, onChange }: StatusPickerProps) {
	return (
		<div className="flex gap-1.5">
			{STATUSES.map((status) => (
				<button
					key={status}
					type="button"
					onClick={() => onChange(status)}
					className={cn(
						"rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
						value === status ? ACTIVE_CLASSES[status] : "border-border text-muted-foreground hover:bg-muted"
					)}
				>
					{ATTENDANCE_STATUS_LABELS[status]}
				</button>
			))}
		</div>
	);
}