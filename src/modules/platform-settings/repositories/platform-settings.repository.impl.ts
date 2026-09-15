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
            raw = await prisma.platformSettings.create({ data: {} });
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
}