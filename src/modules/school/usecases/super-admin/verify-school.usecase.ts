import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { NotificationService } from "../../../notifications/services/notification.service";
import { addProvisionSchemaJob } from "../../../../infrastructure/jobs/queues/provision-schema.queue";
import { NotFoundError } from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper: SchoolMapper;
    notificationService: NotificationService;
}

export class VerifySchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper: SchoolMapper;
    private readonly notificationService: NotificationService;

    constructor({
        schoolRepository,
        schoolMapper,
        notificationService,
    }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper = schoolMapper;
        this.notificationService = notificationService;
    }

    async execute(
        schoolId: string,
        verifiedByAdminId: string,
    ): Promise<SchoolResponseData> {
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // Already verified — keep this operation idempotent
        if (school.verificationStatus === "verified") {
            return this.schoolMapper.toResponse(school);
        }

        // Mark school as verified.
        // Do NOT make it active yet because the tenant schema
        // may not have been provisioned.
        const updated = await this.schoolRepository.update(schoolId, {
            verificationStatus: "verified",
            verifiedAt: new Date(),
            verifiedById: verifiedByAdminId,
            suspendedAt: null,
            suspensionReason: null,
        });

        // Provision the tenant database/schema.
        await addProvisionSchemaJob({
            schoolId,
            subdomain: school.subdomain,
            schoolName: school.name,
        });

        await this.notificationService.sendPlatformNotification({
            schoolId,
            type: "account_verified",
            title: "Your school has been verified!",
            message: `${updated.name} has been verified and is now being set up. You'll be notified when your school portal is ready.`,
            createdByAdminId: verifiedByAdminId,
        });

        return this.schoolMapper.toResponse(updated);
    }
}
