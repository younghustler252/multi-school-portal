import { getTenantClient }            from "../../../infrastructure/database/prisma/prisma.client";
import { SchoolSettingsMapper }       from "../mappers/school-settings.mapper";
import { SchoolSettingsEntity }       from "../domain/school-settings.entity";
import { ISchoolSettingsRepository }  from "./school-settings.repository";
// import prism

export class SchoolSettingsRepositoryImpl
    implements ISchoolSettingsRepository
{
    private readonly mapper: SchoolSettingsMapper;

    private get db() { return getTenantClient(); }

    constructor({
        schoolSettingsMapper,
    }: {
        schoolSettingsMapper: SchoolSettingsMapper;
    }) {
        this.mapper = schoolSettingsMapper;
    }

    async find(): Promise<SchoolSettingsEntity | null> {
        const raw = await this.db.schoolSettings.findFirst();
        return raw ? this.mapper.toDomain(raw) : null;
    }

    async upsert(data: Record<string, any>): Promise<SchoolSettingsEntity> {
        const existing = await this.db.schoolSettings.findFirst();

        if (existing) {
            const raw = await this.db.schoolSettings.update({
                where: { id: existing.id },
                data,
            });
            return this.mapper.toDomain(raw);
        }

        const raw = await this.db.schoolSettings.create({ data });
        return this.mapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Record<string, any>,
    ): Promise<SchoolSettingsEntity> {
        const raw = await this.db.schoolSettings.update({
            where: { id },
            data,
        });
        return this.mapper.toDomain(raw);
    }
}