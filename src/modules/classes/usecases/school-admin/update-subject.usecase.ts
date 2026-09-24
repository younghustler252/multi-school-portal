import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";
import { NotFoundError, BadRequestError } from "../../../../shared/errors/domain.errors";


interface Dependencies {
    classRepository: IClassRepository;
    staffRepository: IStaffRepository;
    sessionRepository: ISessionRepository;
    classSubjectResolutionService: ClassSubjectResolutionService;
}

interface UpdateSubjectDTO {
    name?: string;
    code?: string | null;
    defaultTeacherId?: string | null;
}

export class UpdateSubjectUseCase {
    private readonly classRepository: IClassRepository;
    private readonly staffRepository: IStaffRepository;
    private readonly sessionRepository: ISessionRepository;
    private readonly classSubjectResolutionService: ClassSubjectResolutionService;

    constructor({
        classRepository,
        staffRepository,
        sessionRepository,
        classSubjectResolutionService,
    }: Dependencies) {
        this.classRepository = classRepository;
        this.staffRepository = staffRepository;
        this.sessionRepository = sessionRepository;
        this.classSubjectResolutionService = classSubjectResolutionService;
    }

    async execute(subjectId: string, dto: UpdateSubjectDTO) {
        const subject = await this.classRepository.findSubjectById(subjectId);
        if (!subject) {
            throw new NotFoundError("Subject not found");
        }

        if (dto.defaultTeacherId) {
            const staff = await this.staffRepository.findById(dto.defaultTeacherId);

            if (!staff) {
                throw new NotFoundError("Staff member not found");
            }

            if (staff.role !== "teacher" && staff.role !== "principal") {
                throw new BadRequestError(
                    "Subject default teacher must be a teacher or principal.",
                );
            }
        }

        const updatedSubject = await this.classRepository.updateSubject(
            subjectId,
            dto,
        );

        if (dto.defaultTeacherId !== undefined) {
            const currentTerm = await this.sessionRepository.findCurrentTerm();

            if (currentTerm) {
                await this.classSubjectResolutionService.recascadeSubjectDefault(
                    subjectId,
                    currentTerm.id,
                );
            }
        }

        return updatedSubject;
    }
}
