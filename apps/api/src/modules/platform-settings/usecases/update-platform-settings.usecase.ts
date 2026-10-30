// UpdatePlatformSettingsUseCase
import { IPlatformSettingsRepository } from "../repositories/platform-settings.repository";
import { PlatformSettingsMapper, PlatformSettingsResponseData } from "../mappers/platform-settings.mapper";
import { UpdatePlatformSettingsDtoType } from "../dtos/platform-settings.dto";

interface Dependencies {
    platformSettingsRepository: IPlatformSettingsRepository;
    platformSettingsMapper:     PlatformSettingsMapper;
}

export class UpdatePlatformSettingsUseCase {
    private readonly platformSettingsRepository: IPlatformSettingsRepository;
    private readonly platformSettingsMapper:     PlatformSettingsMapper;

    constructor({ platformSettingsRepository, platformSettingsMapper }: Dependencies) {
        this.platformSettingsRepository = platformSettingsRepository;
        this.platformSettingsMapper     = platformSettingsMapper;
    }

    async execute(dto: UpdatePlatformSettingsDtoType): Promise<PlatformSettingsResponseData> {
        const settings = await this.platformSettingsRepository.update(dto);
        return this.platformSettingsMapper.toResponse(settings);
    }
}