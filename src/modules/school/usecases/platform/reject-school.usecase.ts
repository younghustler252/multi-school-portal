import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { NotificationService } from "../../../notifications/services/notification.service";
import { AuditService } from "../../../audit/services/audit.service";
import { invalidateSchoolVerificationCache } from "../../../../infrastructure/middleware/require-verified-school.middleware";
import { schoolErrors } from "../../domain/school.errors";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper;
    notificationService: NotificationService; auditService: AuditService;
}

/*
| REJECT VERIFICATION. The school is NOT deactivated (the old version deactivated it and stored the reason
| in the suspension column). It keeps working with locked features, sees the reason, and can upload
| corrected documents, which moves it back to "under_review".
*/
export class RejectSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorId: string, reason: string): Promise<PlatformSchoolResponseData> {
        const d = this.d;
        const row = await d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();

        const updated = await d.schoolRepository.update(schoolId, {
            verificationStatus: "rejected", verificationNote: reason, verifiedAt: null, verifiedById: null,
        });
        invalidateSchoolVerificationCache(schoolId);

        await d.auditService.log({
            userId: actorId, schoolId, action: "school.verification_rejected", entity: "School", entityId: schoolId,
            oldValue: { verificationStatus: row.school.verificationStatus }, newValue: { verificationStatus: "rejected" }, metadata: { reason },
        });
        await d.notificationService.sendPlatformNotification({
            schoolId, type: "account_rejected", createdByAdminId: actorId,
            title: "Verification needs attention", message: reason,
        });
        return d.schoolMapper.toPlatformResponse(updated, row.plan, row.mrrKobo);
    }
}
