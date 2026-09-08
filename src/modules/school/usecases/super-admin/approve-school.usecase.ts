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
}

export class ApproveSchoolUseCase {
    private readonly schoolRepository:    ISchoolRepository;
    private readonly schoolMapper:        SchoolMapper;
    private readonly notificationService: NotificationService;

    constructor({ schoolRepository, schoolMapper, notificationService }: Dependencies) {
        this.schoolRepository    = schoolRepository;
        this.schoolMapper        = schoolMapper;
        this.notificationService = notificationService;
    }

    async execute(schoolId: string, approvedByAdminId: string): Promise<SchoolResponseData> {
        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);

        if (school.status === "active") {
            return this.schoolMapper.toResponse(school); // already live — idempotent, not an error
        }

        const updated = await this.schoolRepository.update(schoolId, {
            verificationStatus: "verified",
            status:             "active",
            isActive:           true,
            verifiedAt:         new Date(),
            verifiedById:       approvedByAdminId,
            suspendedAt:        null,
            suspensionReason:   null,
        });

        await addProvisionSchemaJob({
            schoolId,
            subdomain:  school.subdomain,
            schoolName: school.name,
        });

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