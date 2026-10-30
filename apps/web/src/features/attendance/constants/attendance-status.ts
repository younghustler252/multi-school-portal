import { AttendanceStatus } from "../types/attendance.types";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
	present: "Present",
	absent: "Absent",
	late: "Late",
	excused: "Excused",
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
	present: "bg-success/10 text-success border-success/30",
	absent: "bg-destructive/10 text-destructive border-destructive/30",
	late: "bg-warning/15 text-warning-foreground border-warning/30",
	excused: "bg-info/10 text-info border-info/30",
};