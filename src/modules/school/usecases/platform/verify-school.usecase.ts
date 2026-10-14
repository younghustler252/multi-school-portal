import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { NotificationService } from "../../../notifications/services/notification.service";
import { AuditService } from "../../../audit/services/audit.service";
import { invalidateSchoolVerificationCache } from "../../../../infrastructure/middleware/require-verified-school.middleware";
import { schoolErrors } from "../../domain/school.errors";
import { requiredDocsFor } from "../../domain/school.policy";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper;
    notificationService: NotificationService; auditService: AuditService;
}

/*
| VERIFY SCHOOL: unlocks payments, SMS and result publishing.
| It does NOT build or activate the school (that already happened when the email was confirmed),
| so the old approve / verify / activate trio is now this one action.
| Normally triggered automatically when all required documents are approved. A person may verify
| with override=true when required documents are missing; that is recorded in the audit entry.
*/
export class VerifySchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorId: string, opts: { note?: string; override?: boolean }): Promise<PlatformSchoolResponseData> {
        const d = this.d;
        const row = await d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();
        const school = row.school;

        if (school.verificationStatus === "verified") return d.schoolMapper.toPlatformResponse(school, row.plan, row.mrrKobo);

        const docs = await d.schoolRepository.findDocumentsBySchoolId(schoolId);
        const missing = requiredDocsFor(school.schoolOwnership).filter(t => !docs.some(x => x.type === t && x.status === "approved"));
        if (missing.length && !opts.override) throw schoolErrors.documentsIncomplete();

        const updated = await d.schoolRepository.update(schoolId, {
            verificationStatus: "verified", verifiedAt: new Date(), verifiedById: actorId, verificationNote: opts.note ?? null,
        });
        invalidateSchoolVerificationCache(schoolId);

        await d.auditService.log({
            userId: actorId, schoolId, action: "school.verified", entity: "School", entityId: schoolId,
            oldValue: { verificationStatus: school.verificationStatus },
            newValue: { verificationStatus: "verified" },
            metadata: { overrideMissingDocuments: missing.length ? missing : undefined, note: opts.note },
        });
        await d.notificationService.sendPlatformNotification({
            schoolId, type: "account_verified", createdByAdminId: actorId,
            title: "Your school is verified",
            message: `${updated.name} is now verified. Online payments, SMS and result publishing are unlocked.`,
        });
        return d.schoolMapper.toPlatformResponse(updated, row.plan, row.mrrKobo);
    }
}
