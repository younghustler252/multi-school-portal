import { IMapper } from "../../../infrastructure/repository/base.repository";
import { PlatformSettingsEntity } from "../domain/platform-settings.entity";

export type PlatformSettingsResponseData = PlatformSettingsEntity;

export class PlatformSettingsMapper implements IMapper<any, PlatformSettingsEntity> {
    toDomain(raw: any): PlatformSettingsEntity {
        return {
            id:                          raw.id,
            platformName:                raw.platformName,
            supportEmail:                raw.supportEmail,
            supportPhone:                raw.supportPhone ?? null,
            logoUrl:                     raw.logoUrl ?? null,
            termsUrl:                    raw.termsUrl ?? null,
            privacyPolicyUrl:            raw.privacyPolicyUrl ?? null,
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