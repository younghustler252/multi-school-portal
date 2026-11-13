export interface PlatformSettingsResponseData {
	id: string;
	platformName: string;
	supportEmail: string;
	supportPhone: string | null;
	logoUrl: string | null;
	termsUrl: string | null;
	privacyPolicyUrl: string | null;
	subscriptionGracePeriodDays: number;
	reminderDaysBeforeExpiry: number;
	defaultTrialDays: number;
	allowNewRegistrations: boolean;
	maintenanceMode: boolean;
	maintenanceMessage: string | null;
	announcementBanner: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface UpdatePlatformSettingsDto {
	platformName?: string;
	supportEmail?: string;
	supportPhone?: string;
	// The logo is not part of this update: it is uploaded and removed with their own calls (see platform-settings.api.ts).
	// Links must be https. Send null to clear one.
	termsUrl?: string | null;
	privacyPolicyUrl?: string | null;
	subscriptionGracePeriodDays?: number;
	reminderDaysBeforeExpiry?: number;
	defaultTrialDays?: number;
	allowNewRegistrations?: boolean;
	maintenanceMode?: boolean;
	maintenanceMessage?: string;
	announcementBanner?: string;
}