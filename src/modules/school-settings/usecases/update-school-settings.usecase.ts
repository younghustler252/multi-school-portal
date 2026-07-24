import { ISchoolSettingsRepository }      from "../repositories/school-settings.repository";
import { SchoolSettingsMapper }           from "../mappers/school-settings.mapper";
import { SchoolSettingsResponseData }     from "../mappers/school-settings.mapper";
import { UpdateSchoolSettingsDtoType }    from "../dtos/school-settings.dto";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
}

export class UpdateSchoolSettingsUseCase {
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;
    private readonly schoolSettingsMapper:     SchoolSettingsMapper;

    constructor({
        schoolSettingsRepository,
        schoolSettingsMapper,
    }: Dependencies) {
        this.schoolSettingsRepository = schoolSettingsRepository;
        this.schoolSettingsMapper     = schoolSettingsMapper;
    }

    async execute(
        dto: UpdateSchoolSettingsDtoType,
    ): Promise<SchoolSettingsResponseData> {
        const settings = await this.schoolSettingsRepository.upsert(dto);
        return this.schoolSettingsMapper.toResponse(settings);
    }
}