import { IClassRepository }              from "../../repositories/class.repository";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";
import { NotFoundError }                 from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }             from "../../domain/class.enums";
import { ClassSubjectAssignmentSource }  from "../../domain/class.enums";

interface Dependencies {
    classRepository:               IClassRepository;
    classSubjectResolutionService: ClassSubjectResolutionService;
}

export class ClearSubjectOverrideUseCase {
    private readonly classRepository:               IClassRepository;
    private readonly classSubjectResolutionService: ClassSubjectResolutionService;

    constructor({ classRepository, classSubjectResolutionService }: Dependencies) {
        this.classRepository               = classRepository;
        this.classSubjectResolutionService = classSubjectResolutionService;
    }

    async execute(classSubjectId: string) {
        const existing = await this.classRepository.findClassSubjectById(classSubjectId);
        if (!existing) throw new NotFoundError(ClassErrorMessage.CLASS_SUBJECT_NOT_FOUND);

        const resolved = await this.classSubjectResolutionService.resolve(existing.classId, existing.subjectId);

        if (!resolved) {
            // nothing to fall back to — genuinely becomes unassigned
            await this.classRepository.removeSubject(classSubjectId);
            return null;
        }

        return this.classRepository.updateClassSubject(classSubjectId, {
            staffId:     resolved.staffId,
            assignedVia: resolved.assignedVia,
        });
    }
}