import { SchoolNotificationType, TargetType, NotificationChannel } from "../types/notification.types";

export const NOTIFICATION_TYPE_LABELS: Record<SchoolNotificationType, string> = {
	fee_invoice: "Fee Invoice",
	fee_reminder: "Fee Reminder",
	fee_receipt: "Fee Receipt",
	report_card_ready: "Report Card Ready",
	attendance_alert: "Attendance Alert",
	event: "Event",
	holiday: "Holiday",
	broadcast: "Broadcast",
	custom: "Custom",
};

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
	STUDENT: "Specific student(s)",
	GUARDIAN: "Specific guardian(s)",
	STAFF: "Specific staff",
	ALL_PARENTS: "All parents",
	ALL_STUDENTS: "All students",
	ALL_STAFF: "All staff",
	EVERYONE: "Everyone",
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
	IN_APP: "In-app",
	EMAIL: "Email",
	SMS: "SMS",
};