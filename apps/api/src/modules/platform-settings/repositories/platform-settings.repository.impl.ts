import { prisma } from "../../../infrastructure/database/prisma/prisma.client";
import { PlatformSettingsMapper } from "../mappers/platform-settings.mapper";
import { PlatformSettingsEntity } from "../domain/platform-settings.entity";
import { IPlatformSettingsRepository } from "./platform-settings.repository";

export class PlatformSettingsRepositoryImpl implements IPlatformSettingsRepository {
    private readonly mapper: PlatformSettingsMapper;

    constructor({ platformSettingsMapper }: { platformSettingsMapper: PlatformSettingsMapper }) {
        this.mapper = platformSettingsMapper;
    }

    async find(): Promise<PlatformSettingsEntity> {
        let raw = await prisma.platformSettings.findFirst();

        if (!raw) {
            // The table holds at most one row (unique index PlatformSettings_singleton): of two first reads at once, one create wins and the
            // other gets P2002 and reads the winner's row (REM-083)
            try { raw = await prisma.platformSettings.create({ data: {} }); }
            catch (e: any) {
                if (e?.code !== "P2002") throw e;
                raw = await prisma.platformSettings.findFirst();
                if (!raw) throw e;
            }
        }

        return this.mapper.toDomain(raw);
    }

    async update(data: Record<string, any>): Promise<PlatformSettingsEntity> {
        const existing = await this.find();

        const raw = await prisma.platformSettings.update({
            where: { id: existing.id },
            data,
        });

        return this.mapper.toDomain(raw);
    }

    async setLogo(url: string | null): Promise<PlatformSettingsEntity> {
        return this.update({ logoUrl: url });
    }
}
