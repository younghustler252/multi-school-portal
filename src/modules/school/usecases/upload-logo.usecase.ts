import { ISchoolRepository } from "../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../mappers/school.mapper";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { AuditService } from "../../audit/services/audit.service";
import { sniffFile, FILE_EXTENSION } from "../../../shared/utils/file-sniff";
import { schoolErrors } from "../domain/school.errors";
import { env } from "../../../config/env";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper;
    storageService: SupabaseStorageService; auditService: AuditService;
}

const MAX_BYTES = 2 * 1024 * 1024;

// JPEG, PNG or WebP only, judged by the file's own bytes. SVG is refused on purpose (it can carry scripts).
export class UploadLogoUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, file: { buffer: Buffer }): Promise<SchoolResponseData> {
        const d = this.d;
        const school = await d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();

        const type = sniffFile(file.buffer);
        if (file.buffer.length > MAX_BYTES || !type || type === "application/pdf") throw schoolErrors.invalidImage();

        const result = await d.storageService.upload({
            bucket: env.supabase.publicBucket, folder: `schools/${schoolId}/logos`,
            file: file.buffer, mimetype: type, filename: `logo-${Date.now()}.${FILE_EXTENSION[type]}`,
        });
        const updated = await d.schoolRepository.updateLogo(schoolId, result.url);
        await d.auditService.log({ userId: actorUserId, schoolId, action: "school.logo_changed", entity: "School", entityId: schoolId });
        return d.schoolMapper.toResponse(updated);
    }
}
