import { ISchoolSettingsRepository }    from "../repositories/school-settings.repository";
import { SchoolSettingsMapper }         from "../mappers/school-settings.mapper";
import { SchoolSettingsResponseData }   from "../mappers/school-settings.mapper";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
}

export class GetSchoolSettingsUseCase {
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;
    private readonly schoolSettingsMapper:     SchoolSettingsMapper;

    constructor({
        schoolSettingsRepository,
        schoolSettingsMapper,
    }: Dependencies) {
        this.schoolSettingsRepository = schoolSettingsRepository;
        this.schoolSettingsMapper     = schoolSettingsMapper;
    }

    async execute(): Promise<SchoolSettingsResponseData | null> {
        const settings = await this.schoolSettingsRepository.find();
        return settings
            ? this.schoolSettingsMapper.toResponse(settings)
            : null;
    }
}