import { SchoolSettingsEntity } from "../domain/school-settings.entity";

export interface ISchoolSettingsRepository {
    find():                                          Promise<SchoolSettingsEntity | null>;
    upsert(data: Record<string, any>):               Promise<SchoolSettingsEntity>;
    update(id: string, data: Record<string, any>):   Promise<SchoolSettingsEntity>;
}