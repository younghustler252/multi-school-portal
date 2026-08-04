import { ISchoolRepository }        from "../../repositories/school.repository";
import { SchoolMapper }             from "../../mappers/school.mapper";
import { SchoolResponseData }       from "../../mappers/school.mapper";
import { SupabaseStorageService }   from "../../../../infrastructure/storage/supabase-storage.service";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }       from "../../domain/school.enum";
import { env } from "../../../../config/env";

/*
|--------------------------------------------------------------------------
| UPLOAD LOGO USE CASE
| School admin uploads their school logo
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
    storageService:   SupabaseStorageService;
}

export class UploadLogoUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;
    private readonly storageService:   SupabaseStorageService;

    constructor({
        schoolRepository,
        schoolMapper,
        storageService,
    }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
        this.storageService   = storageService;
    }

    async execute(
        schoolId: string,
        file: {
            buffer:   Buffer;
            mimetype: string;
            filename: string;
        },
    ): Promise<SchoolResponseData> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Upload to storage ─────────────────────────────────────────────
        const result = await this.storageService.upload({
            bucket:   env.supabase.publicBucket,
            folder:   `schools/${schoolId}/logos`,
            file:     file.buffer,
            mimetype: file.mimetype,
            filename: file.filename,
        });

        const updated = await this.schoolRepository.updateLogo(
            schoolId,
            result.url,
        );

        return this.schoolMapper.toResponse(updated);
    }
}