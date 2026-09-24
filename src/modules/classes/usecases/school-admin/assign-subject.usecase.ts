import { IClassRepository }        from "../../repositories/class.repository";
import { AssignSubjectDtoType }    from "../../dtos/class.dto";
import { ClassSubjectAssignmentSource } from "../../domain/class.enums";

interface Dependencies {
    classRepository: IClassRepository;
}

export class AssignSubjectUseCase {
    private readonly classRepository: IClassRepository;

    constructor({ classRepository }: Dependencies) {
        this.classRepository = classRepository;
    }

    async execute(classId: string, dto: AssignSubjectDtoType) {
        const existing = await this.classRepository.findClassSubject(classId, dto.subjectId, dto.termId);

        if (existing) {
            return this.classRepository.updateClassSubject(existing.id, {
                staffId: dto.staffId, assignedVia: ClassSubjectAssignmentSource.manual,
            });
        }

        return this.classRepository.assignSubject({
            classId, subjectId: dto.subjectId, staffId: dto.staffId,
            termId: dto.termId, assignedVia: ClassSubjectAssignmentSource.manual,
        });
    }
}