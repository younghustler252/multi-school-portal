import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { SchoolSettingsMapper } from "../mappers/school-settings.mapper";
import { SchoolSettingsEntity } from "../domain/school-settings.entity";
import { ISchoolSettingsRepository } from "./school-settings.repository";

export class SchoolSettingsRepositoryImpl
    extends BaseTenantRepository<SchoolSettingsEntity>
    implements ISchoolSettingsRepository
{
    protected readonly modelName = "schoolSettings";

    constructor({ schoolSettingsMapper }: { schoolSettingsMapper: SchoolSettingsMapper }) {
        super(schoolSettingsMapper);
    }

    async find(): Promise<SchoolSettingsEntity | null> {
        return this.findOne({});
    }

    async upsert(data: Record<string, any>): Promise<SchoolSettingsEntity> {
        const existing = await this.model().findFirst();

        if (existing) {
            return this.update(existing.id, data);
        }

        return this.create(data);
    }
}