import { ISchoolSettingsRepository }    from "../repositories/school-settings.repository";
import { SchoolSettingsMapper }         from "../mappers/school-settings.mapper";
import { SchoolSettingsResponseData }   from "../mappers/school-settings.mapper";
import { SupabaseStorageService }       from "../../../infrastructure/storage/supabase-storage.service";

/*
|--------------------------------------------------------------------------
| UPLOAD STAMP USE CASE
| Uploads school stamp or principal signature image
| Used on report cards
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
    storageService:           SupabaseStorageService;
}

export class UploadStampUseCase {
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;
    private readonly schoolSettingsMapper:     SchoolSettingsMapper;
    private readonly storageService:           SupabaseStorageService;

    constructor({
        schoolSettingsRepository,
        schoolSettingsMapper,
        storageService,
    }: Dependencies) {
        this.schoolSettingsRepository = schoolSettingsRepository;
        this.schoolSettingsMapper     = schoolSettingsMapper;
        this.storageService           = storageService;
    }

    async execute(
        schoolId: string,
        type:     "stamp" | "signature",
        file: {
            buffer:   Buffer;
            mimetype: string;
            filename: string;
        },
    ): Promise<SchoolSettingsResponseData> {

        const result = await this.storageService.upload({
            folder:   `schools/${schoolId}/${type}`,
            file:     file.buffer,
            mimetype: file.mimetype,
            filename: file.filename,
        });

        const settings = await this.schoolSettingsRepository.upsert({
            [type]: result.url,
        });

        return this.schoolSettingsMapper.toResponse(settings);
    }
}