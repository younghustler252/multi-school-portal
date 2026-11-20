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
	/** null = not marked yet: no button is highlighted. */
	value: AttendanceStatus | null;
	onChange: (status: AttendanceStatus) => void;
	disabled?: boolean;
}

export function StatusPicker({ value, onChange, disabled }: StatusPickerProps) {
	return (
		<div className="flex gap-1.5">
			{STATUSES.map((status) => (
				<button
					key={status}
					type="button"
					disabled={disabled}
					onClick={() => onChange(status)}
					className={cn(
						"rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
						value === status ? ACTIVE_CLASSES[status] : "border-border text-muted-foreground enabled:hover:bg-muted"
					)}
				>
					{ATTENDANCE_STATUS_LABELS[status]}
				</button>
			))}
		</div>
	);
}