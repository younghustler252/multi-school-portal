import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { NotificationService } from "../../../notifications/services/notification.service";
import { NotFoundError } from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper: SchoolMapper;
    notificationService: NotificationService;
}

export class ActivateSchoolUseCase {
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
        createdByAdminId: string
    ): Promise<SchoolResponseData> {
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        const updatedSchool = await this.schoolRepository.update(schoolId, {
            isActive: true,
            status: "active",
            suspendedAt: null,
            suspensionReason: null,
        });

        await this.notificationService.sendPlatformNotification({
            schoolId,
            type: "account_verified",
            title: "Your school is now live!",
            message: `${updatedSchool.name} has been approved and is ready to use. You can now log in at your school's portal.`,
            createdByAdminId,
        });

        return this.schoolMapper.toResponse(updatedSchool);
    }
}