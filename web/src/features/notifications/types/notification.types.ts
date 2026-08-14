export type SchoolNotificationType =
	| "fee_invoice" | "fee_reminder" | "fee_receipt" | "report_card_ready"
	| "attendance_alert" | "event" | "holiday" | "broadcast" | "custom";

export type TargetType =
	| "STUDENT" | "GUARDIAN" | "STAFF"
	| "ALL_PARENTS" | "ALL_STUDENTS" | "ALL_STAFF" | "EVERYONE";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";

export interface SchoolNotificationResponseData {
	id: string;
	title: string;
	message: string;
	type: SchoolNotificationType;
	targetType: TargetType;
	sentById: string;
	sentAt: string | null;
	createdAt: string;
}

export interface SendSchoolNotificationDto {
	title: string;
	message: string;
	type: SchoolNotificationType;
	targetType: TargetType;
	channels: NotificationChannel[];
	metadata?: Record<string, unknown>;
	studentIds?: string[];
	guardianIds?: string[];
	staffIds?: string[];
}

export interface ListNotificationsParams {
	page?: number;
	limit?: number;
	type?: SchoolNotificationType;
	state?: string;
}