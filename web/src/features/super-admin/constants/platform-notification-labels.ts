import { PlatformNotificationType } from "../types/platform-notification.types";

export const PLATFORM_NOTIFICATION_TYPE_LABELS: Record<PlatformNotificationType, string> = {
	welcome: "Welcome",
	feature_announcement: "Feature Announcement",
	subscription_expiry: "Subscription Expiry",
	subscription_renewed: "Subscription Renewed",
	subscription_failed: "Subscription Failed",
	account_suspended: "Account Suspended",
	account_verified: "Account Verified",
	account_rejected: "Account Rejected",
	system_alert: "System Alert",
};