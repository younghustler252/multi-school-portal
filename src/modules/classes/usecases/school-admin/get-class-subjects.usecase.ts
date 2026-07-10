import { IClassRepository }         from "../../repositories/class.repository";
import { ClassSubjectMapper }       from "../../mappers/class.mapper";
import { ClassSubjectResponseData } from "../../mappers/class.mapper";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }        from "../../domain/class.enums";

interface Dependencies {
    classRepository:    IClassRepository;
    classSubjectMapper: ClassSubjectMapper;
}

export class GetClassSubjectsUseCase {
    private readonly classRepository:    IClassRepository;
    private readonly classSubjectMapper: ClassSubjectMapper;

    constructor({ classRepository, classSubjectMapper }: Dependencies) {
        this.classRepository    = classRepository;
        this.classSubjectMapper = classSubjectMapper;
    }

    async execute(
        classId: string,
    ): Promise<ClassSubjectResponseData[]> {
        const cls = await this.classRepository.findClassById(classId);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        const assignments = await this.classRepository
            .findClassSubjects(classId);

        return assignments.map(a => this.classSubjectMapper.toResponse(a));
    }
}