import { AuditService } from "../../../audit/services/audit.service";
import { ISchoolRepository }     from "../../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { NotificationService }   from "../../../notifications/services/notification.service";
import { addProvisionSchemaJob } from "../../../../infrastructure/jobs/queues/provision-schema.queue";
import { NotFoundError }         from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }    from "../../domain/school.enum";

interface Dependencies {
    schoolRepository:    ISchoolRepository;
    schoolMapper:        SchoolMapper;
    notificationService: NotificationService;
    auditService:        AuditService;
}

export class ApproveSchoolUseCase {
    private readonly schoolRepository:    ISchoolRepository;
    private readonly schoolMapper:        SchoolMapper;
    private readonly notificationService: NotificationService;
    private readonly auditService:        AuditService;

    constructor({
        schoolRepository,
        schoolMapper,
        notificationService,
        auditService,
    }: Dependencies) {
        this.schoolRepository    = schoolRepository;
        this.schoolMapper        = schoolMapper;
        this.notificationService = notificationService;
        this.auditService        = auditService;
    }

    async execute(
        schoolId:         string,
        approvedByAdminId: string,
    ): Promise<SchoolResponseData> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);

        // ── Already active — idempotent ────────────────────────────────────
        if (school.status === "active") {
            return this.schoolMapper.toResponse(school); // already live — idempotent, not an error
        }

        const oldState = {
            verificationStatus: school.verificationStatus,
            status:             school.status,
            isActive:           school.isActive,
            verifiedAt:         school.verifiedAt,
            verifiedById:       school.verifiedById,
            suspendedAt:        school.suspendedAt,
            suspensionReason:   school.suspensionReason,
        };

        // ── Approve school ────────────────────────────────────────────────
        const updated = await this.schoolRepository.update(schoolId, {
            verificationStatus: "verified",
            status:             "active",
            isActive:           true,
            verifiedAt:         new Date(),
            verifiedById:       approvedByAdminId,
            suspendedAt:        null,
            suspensionReason:   null,
        });

        // ── Audit school approval ─────────────────────────────────────────
        await this.auditService.log({
            userId:   approvedByAdminId,
            schoolId,
            action:   "school.approved",
            entity:   "School",
            entityId: schoolId,
            oldValue: oldState,
            newValue: {
                verificationStatus: updated.verificationStatus,
                status:             updated.status,
                isActive:           updated.isActive,
                verifiedAt:         updated.verifiedAt,
                verifiedById:       updated.verifiedById,
                suspendedAt:        updated.suspendedAt,
                suspensionReason:   updated.suspensionReason,
            },
        });

        // ── Provision school schema ───────────────────────────────────────
        await addProvisionSchemaJob({
            schoolId,
            subdomain:  school.subdomain,
            schoolName: school.name,
        });

        // ── Notify school ─────────────────────────────────────────────────
        await this.notificationService.sendPlatformNotification({
            schoolId,
            type:             "account_verified",
            title:            "Your school is now live!",
            message:          `${updated.name} has been approved and is being set up now. You'll be able to log in at your school's portal shortly.`,
            createdByAdminId: approvedByAdminId,
        });

        return this.schoolMapper.toResponse(updated);
    }
}
