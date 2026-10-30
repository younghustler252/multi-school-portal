import { PlatformSettingsEntity } from "../domain/platform-settings.entity";

export interface IPlatformSettingsRepository {
    find(): Promise<PlatformSettingsEntity>;
    update(data: Record<string, any>): Promise<PlatformSettingsEntity>;
}