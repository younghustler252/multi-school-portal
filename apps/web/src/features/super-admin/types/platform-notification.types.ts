export type PlatformNotificationType =
	| "welcome" | "feature_announcement" | "subscription_expiry"
	| "subscription_renewed" | "subscription_failed" | "account_suspended"
	| "account_verified" | "account_rejected" | "system_alert";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";

export interface PlatformNotificationResponseData {
	id: string;
	title: string;
	message: string;
	type: string;
	state: string;
	createdByAdminId: string;
	sentAt: string | null;
	completedAt: string | null;
	createdAt: string;
}

export interface SendPlatformNotificationDto {
	title: string;
	message: string;
	type: PlatformNotificationType;
	channels: NotificationChannel[];
	schoolIds?: string[]; // the chosen schools (at least one); send this OR broadcastAll, never both
	broadcastAll?: boolean; // true = every active school
	metadata?: Record<string, unknown>;
}

export interface ListPlatformNotificationsParams {
	page?: number;
	limit?: number;
	type?: string;
	state?: string;
}