// GetPlatformSettingsUseCase
import { IPlatformSettingsRepository } from "../repositories/platform-settings.repository";
import { PlatformSettingsMapper, PlatformSettingsResponseData } from "../mappers/platform-settings.mapper";

interface Dependencies {
    platformSettingsRepository: IPlatformSettingsRepository;
    platformSettingsMapper:     PlatformSettingsMapper;
}

export class GetPlatformSettingsUseCase {
    private readonly platformSettingsRepository: IPlatformSettingsRepository;
    private readonly platformSettingsMapper:     PlatformSettingsMapper;

    constructor({ platformSettingsRepository, platformSettingsMapper }: Dependencies) {
        this.platformSettingsRepository = platformSettingsRepository;
        this.platformSettingsMapper     = platformSettingsMapper;
    }

    async execute(): Promise<PlatformSettingsResponseData> {
        const settings = await this.platformSettingsRepository.find();
        return this.platformSettingsMapper.toResponse(settings);
    }
}