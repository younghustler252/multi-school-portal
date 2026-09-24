import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ISchoolSettingsRepository } from "../../../school-settings/repositories/school-settings.repository";
import { NotFoundError, BadRequestError } from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage } from "../../domain/class.enums";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";

interface Dependencies {
    classRepository: IClassRepository;
    staffRepository: IStaffRepository;
    sessionRepository: ISessionRepository;
    schoolSettingsRepository: ISchoolSettingsRepository;
    classSubjectResolutionService: ClassSubjectResolutionService;
}

export class SetClassTeacherUseCase {
    private readonly classRepository: IClassRepository;
    private readonly staffRepository: IStaffRepository;
    private readonly sessionRepository: ISessionRepository;
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;
    private readonly classSubjectResolutionService: ClassSubjectResolutionService;

    constructor({
        classRepository,
        staffRepository,
        sessionRepository,
        schoolSettingsRepository,
        classSubjectResolutionService,
    }: Dependencies) {
        this.classRepository = classRepository;
        this.staffRepository = staffRepository;
        this.sessionRepository = sessionRepository;
        this.schoolSettingsRepository = schoolSettingsRepository;
        this.classSubjectResolutionService = classSubjectResolutionService;
    }

    async execute(classId: string, staffId: string | null) {
        const cls = await this.classRepository.findClassById(classId);

        if (!cls) {
            throw new NotFoundError(ClassErrorMessage.NOT_FOUND);
        }

        if (staffId) {
            const staff = await this.staffRepository.findById(staffId);

            if (!staff) {
                throw new NotFoundError("Staff member not found");
            }

            if (staff.role !== "teacher" && staff.role !== "principal") {
                throw new BadRequestError(
                    "Class teacher must be a teacher or principal.",
                );
            }
        }

        const updatedClass = await this.classRepository.updateClass(classId, {
            classTeacherId: staffId,
        });

        const settings = await this.schoolSettingsRepository.find();

        if (settings?.teachingModel === "homeroom") {
            const currentTerm =
                await this.sessionRepository.findCurrentTerm();

            if (currentTerm) {
                await this.classSubjectResolutionService.recascadeHomeroom(
                    classId,
                    currentTerm.id,
                );
            }
        }

        return updatedClass;
    }
}
