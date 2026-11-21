import { ISchoolSettingsRepository }  from "../repositories/school-settings.repository";
import { SchoolSettingsMapper, SchoolSettingsResponseData } from "../mappers/school-settings.mapper";
import { SupabaseStorageService }     from "../../../infrastructure/storage/supabase-storage.service";
import { EntitlementsService }        from "../../../foundation/entitlements.service";
import { AuditService }               from "../../audit/services/audit.service";
import { FeatureNotAvailableError }   from "../../../shared/errors/domain.errors";
import { checkBrandingImage, LETTERHEAD_IMAGE_MAX_BYTES } from "../domain/branding-image";
import { schoolSettingsErrors }       from "../domain/school-settings.errors";
import { env }                        from "../../../config/env";

interface Dependencies {
    schoolSettingsRepository: ISchoolSettingsRepository;
    schoolSettingsMapper:     SchoolSettingsMapper;
    storageService:           SupabaseStorageService;
    entitlementsService:      EntitlementsService;
    auditService:             AuditService;
}

/*
| UPLOAD the report card letterhead picture (POST /school-settings/letterhead).
| Same picture rules as the stamp (real PNG, JPEG or WebP read from the first bytes) with a 5 MB limit, because it is a full-page
| background. It needs the plan feature report_cards.letterhead, exactly like setting the letterhead URL by hand, and the plan is
| checked BEFORE the file is stored. Uploading only sets reportCardLetterheadUrl; the school still chooses the "custom_letterhead"
| template (and the content margins) with PUT /school-settings. The old picture is replaced, not kept.
*/
export class UploadLetterheadUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, file: { buffer: Buffer }): Promise<SchoolSettingsResponseData> {
        const decision = await this.d.entitlementsService.checkFeature(schoolId, "report_cards.letterhead");
        if (!decision.allowed) throw new FeatureNotAvailableError("report_cards.letterhead");

        const checked = checkBrandingImage(file.buffer, LETTERHEAD_IMAGE_MAX_BYTES);
        if (!checked.ok) throw schoolSettingsErrors.imageInvalid(checked.code, checked.message);

        const result = await this.d.storageService.upload({
            bucket:   env.supabase.publicBucket,
            folder:   `schools/${schoolId}/letterhead`,
            file:     file.buffer,
            mimetype: checked.type.mimetype,
            filename: `letterhead.${checked.type.extension}`,
        });

        const settings = await this.d.schoolSettingsRepository.upsert({ reportCardLetterheadUrl: result.url });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "school_settings.letterhead_uploaded", entity: "SchoolSettings", entityId: settings.id,
            newValue: { url: result.url },
        });
        return this.d.schoolSettingsMapper.toResponse(settings);
    }
}
