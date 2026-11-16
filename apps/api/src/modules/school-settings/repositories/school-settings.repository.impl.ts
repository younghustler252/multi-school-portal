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

        // At most one row exists (unique index SchoolSettings_singleton): of two first saves at once, one create wins and the other
        // updates the winner's row instead of adding a second one (REM-084)
        try { return await this.create(data); }
        catch (e: any) {
            if (e?.code !== "P2002") throw e;
            const winner = await this.model().findFirst();
            if (!winner) throw e;
            return this.update(winner.id, data);
        }
    }
}