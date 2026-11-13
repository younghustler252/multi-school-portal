import { z } from "zod";
import { nullableHttpsUrl } from "../../../shared/utils/safe-url";

export const UpdatePlatformSettingsDto = z.object({
    platformName:                z.string().min(1).max(100).optional(),
    supportEmail:                z.string().email().optional(),
    supportPhone:                z.string().optional(),
    // The logo is never typed in: it is uploaded (POST /platform/settings/logo) and cleared (DELETE /platform/settings/logo).
    // Sending it here is refused with a clear message, not silently ignored.
    logoUrl:                     z.never({ error: "Upload the logo with POST /platform/settings/logo (clear it with DELETE)" }).optional(),
    // Links: https only; send null (or empty text) to clear one.
    termsUrl:                    nullableHttpsUrl(),
    privacyPolicyUrl:            nullableHttpsUrl(),
    subscriptionGracePeriodDays: z.number().int().min(0).max(90).optional(),
    reminderDaysBeforeExpiry:    z.number().int().min(0).max(30).optional(),
    defaultTrialDays:            z.number().int().min(0).max(90).optional(),
    allowNewRegistrations:       z.boolean().optional(),
    maintenanceMode:             z.boolean().optional(),
    maintenanceMessage:          z.string().optional(),
    announcementBanner:          z.string().optional(),
});
export type UpdatePlatformSettingsDtoType = z.infer<typeof UpdatePlatformSettingsDto>;