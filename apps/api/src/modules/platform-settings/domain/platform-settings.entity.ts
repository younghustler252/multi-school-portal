export interface PlatformSettingsEntity {
    id:                          string;
    platformName:                string;
    supportEmail:                string;
    supportPhone:                string | null;
    logoUrl:                     string | null;
    termsUrl:                    string | null;
    privacyPolicyUrl:            string | null;
    subscriptionGracePeriodDays: number;
    reminderDaysBeforeExpiry:    number;
    defaultTrialDays:            number;
    allowNewRegistrations:       boolean;
    maintenanceMode:             boolean;
    maintenanceMessage:          string | null;
    announcementBanner:          string | null;
    createdAt:                   Date;
    updatedAt:                   Date;
}