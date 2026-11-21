import { ISchoolSettingsRepository }  from "../repositories/school-settings.repository";
import { SchoolSettingsMapper, SchoolSettingsResponseData } from "../mappers/school-settings.mapper";
import { SupabaseStorageService }     from "../../../infrastructure/storage/supabase-storage.service";
import { AuditService }               from "../../audit/services/audit.service";
import { checkBrandingImage, LETTERHEAD_IMAGE_MAX_BYTES } from "../domain/branding-image";
import { schoolSettingsErrors }       from "../domain/school-settings.errors";
import { env }                        from "../../../config/env";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
    storageService:           SupabaseStorageService;
    auditService:             AuditService;
}

/*
| UPLOAD the report-card letterhead image (POST /school-settings/letterhead). Same rules as the stamp except the size: PNG, JPEG or WebP
| of at most 5 MB, the type read from the file's first bytes (never from the browser's label). It is stored in the public bucket under the
| school's folder and saved as reportCardLetterheadUrl, which the report-card renderer already reads. The plan feature report_cards.letterhead
| is checked by the route before the file is read. Choosing the custom_letterhead template stays a separate settings change.
*/
export class UploadLetterheadUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, file: { buffer: Buffer }): Promise<SchoolSettingsResponseData> {
        const checked = checkBrandingImage(file.buffer, LETTERHEAD_IMAGE_MAX_BYTES);
        if (!checked.ok) throw schoolSettingsErrors.imageInvalid(checked.code, checked.message);

        const result = await this.d.storageService.upload({
            bucket:   env.supabase.publicBucket,
            folder:   `schools/${schoolId}/letterhead`,
            file:     file.buffer,
            mimetype: checked.type.mimetype,
            filename: `letterhead.${checked.type.extension}`,
        });

        const before   = await this.d.schoolSettingsRepository.find();
        const settings = await this.d.schoolSettingsRepository.upsert({ reportCardLetterheadUrl: result.url });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "school_settings.letterhead_uploaded", entity: "SchoolSettings", entityId: settings.id,
            oldValue: { reportCardLetterheadUrl: before?.reportCardLetterheadUrl ?? null }, newValue: { reportCardLetterheadUrl: result.url },
        });
        return this.d.schoolSettingsMapper.toResponse(settings);
    }
}
