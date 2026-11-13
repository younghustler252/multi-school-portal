import { IMapper } from "../../../infrastructure/repository/base.repository";
import { PlatformSettingsEntity } from "../domain/platform-settings.entity";
import { isHttpsUrl, isSafeHttpUrl } from "../../../shared/utils/safe-url";

// A value saved before the rules tightened (or by hand) is hidden, not shown: only safe links leave the API.
const safeLink = (v: unknown, check: (s: string) => boolean): string | null => (typeof v === "string" && check(v) ? v : null);

export type PlatformSettingsResponseData = PlatformSettingsEntity;

export class PlatformSettingsMapper implements IMapper<any, PlatformSettingsEntity> {
    toDomain(raw: any): PlatformSettingsEntity {
        return {
            id:                          raw.id,
            platformName:                raw.platformName,
            supportEmail:                raw.supportEmail,
            supportPhone:                raw.supportPhone ?? null,
            logoUrl:                     safeLink(raw.logoUrl, isSafeHttpUrl),
            termsUrl:                    safeLink(raw.termsUrl, isHttpsUrl),
            privacyPolicyUrl:            safeLink(raw.privacyPolicyUrl, isHttpsUrl),
            subscriptionGracePeriodDays: raw.subscriptionGracePeriodDays,
            reminderDaysBeforeExpiry:    raw.reminderDaysBeforeExpiry,
            defaultTrialDays:            raw.defaultTrialDays,
            allowNewRegistrations:       raw.allowNewRegistrations,
            maintenanceMode:             raw.maintenanceMode,
            maintenanceMessage:          raw.maintenanceMessage ?? null,
            announcementBanner:          raw.announcementBanner ?? null,
            createdAt:                   raw.createdAt,
            updatedAt:                   raw.updatedAt,
        };
    }

    toResponse(entity: PlatformSettingsEntity): PlatformSettingsResponseData {
        return entity;
    }
}