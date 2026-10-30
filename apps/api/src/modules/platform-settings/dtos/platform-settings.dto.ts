import { z } from "zod";

export const UpdatePlatformSettingsDto = z.object({
    platformName:                z.string().min(1).max(100).optional(),
    supportEmail:                z.string().email().optional(),
    supportPhone:                z.string().optional(),
    logoUrl:                     z.string().url().optional(),
    termsUrl:                    z.string().url().optional(),
    privacyPolicyUrl:            z.string().url().optional(),
    subscriptionGracePeriodDays: z.number().int().min(0).max(90).optional(),
    reminderDaysBeforeExpiry:    z.number().int().min(0).max(30).optional(),
    defaultTrialDays:            z.number().int().min(0).max(90).optional(),
    allowNewRegistrations:       z.boolean().optional(),
    maintenanceMode:             z.boolean().optional(),
    maintenanceMessage:          z.string().optional(),
    announcementBanner:          z.string().optional(),
});
export type UpdatePlatformSettingsDtoType = z.infer<typeof UpdatePlatformSettingsDto>;