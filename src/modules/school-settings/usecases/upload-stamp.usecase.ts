import { ISchoolSettingsRepository }  from "../repositories/school-settings.repository";
import { SchoolSettingsMapper, SchoolSettingsResponseData } from "../mappers/school-settings.mapper";
import { SupabaseStorageService }     from "../../../infrastructure/storage/supabase-storage.service";
import { AuditService }               from "../../audit/services/audit.service";
import { checkBrandingImage }         from "../domain/branding-image";
import { schoolSettingsErrors }       from "../domain/school-settings.errors";
import { env }                        from "../../../config/env";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
    storageService:           SupabaseStorageService;
    auditService:             AuditService;
}

/*
| UPLOAD the stamp or the principal's signature. The file must really be a PNG, JPEG or WebP picture of at most 2 MB:
| the type is read from the file's first bytes, and the stored name and type come from that, never from what the
| browser said. The picture goes to the public bucket under the school's own folder.
*/
export class UploadStampUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(
        schoolId: string, actorUserId: string, type: "stamp" | "signature",
        file: { buffer: Buffer },
    ): Promise<SchoolSettingsResponseData> {
        const checked = checkBrandingImage(file.buffer);
        if (!checked.ok) throw schoolSettingsErrors.imageInvalid(checked.code, checked.message);

        const result = await this.d.storageService.upload({
            bucket:   env.supabase.publicBucket,
            folder:   `schools/${schoolId}/${type}`,
            file:     file.buffer,
            mimetype: checked.type.mimetype,
            filename: `${type}.${checked.type.extension}`,
        });

        const settings = await this.d.schoolSettingsRepository.upsert({ [type]: result.url });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: `school_settings.${type}_uploaded`, entity: "SchoolSettings", entityId: settings.id,
            newValue: { url: result.url },
        });
        return this.d.schoolSettingsMapper.toResponse(settings);
    }
}
