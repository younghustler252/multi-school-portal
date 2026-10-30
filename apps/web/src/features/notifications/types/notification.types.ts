export type SchoolNotificationType =
	| "fee_invoice" | "fee_reminder" | "fee_receipt" | "report_card_ready"
	| "attendance_alert" | "event" | "holiday" | "broadcast" | "custom";

export type TargetType =
	| "STUDENT" | "GUARDIAN" | "STAFF"
	| "ALL_PARENTS" | "ALL_STUDENTS" | "ALL_STAFF" | "EVERYONE";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";

export type NotificationDeliveryStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type NotificationChannelType = "IN_APP" | "EMAIL" | "SMS";
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

export interface NestedNotification {
	id: string;
	title: string;
	message: string;
	type: SchoolNotificationType;
	targetType: TargetType;
	sentById: string;
	metadata: Record<string, unknown> | null;
	sentAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MyNotificationResponseData {
	id: string; // delivery record id — use THIS for markAsRead, not notification.id
	notificationId: string;
	studentId: string | null;
	guardianId: string | null;
	staffId: string | null;
	channel: NotificationChannelType;
	status: NotificationDeliveryStatus;
	priority: NotificationPriority;
	retryCount: number;
	failedReason: string | null;
	providerMsgId: string | null;
	readAt: string | null;
	deliveredAt: string | null;
	createdAt: string;
	updatedAt: string;
	notification: NestedNotification;
}

export interface ListMyNotificationsParams {
	page?: number;
	limit?: number;
	type?: SchoolNotificationType;
	status?: NotificationDeliveryStatus;
}

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

export interface MyNotificationResponseData {
	id: string;
	title: string;
	message: string;
	type: SchoolNotificationType;
	isRead: boolean;
	createdAt: string;
}

export interface ListMyNotificationsParams {
	page?: number;
	limit?: number;
	type?: SchoolNotificationType;
	isRead?: boolean;
}