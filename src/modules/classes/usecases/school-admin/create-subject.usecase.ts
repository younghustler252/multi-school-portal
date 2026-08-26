import { IClassRepository }     from "../../repositories/class.repository";
import { SubjectMapper }        from "../../mappers/class.mapper";
import { SubjectResponseData } from "../../types/class.types";
import { ConflictError }        from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }    from "../../domain/class.enums";
import { CreateSubjectDtoType } from "../../dtos/class.dto";

interface Dependencies {
    classRepository: IClassRepository;
    subjectMapper:   SubjectMapper;
}

export class CreateSubjectUseCase {
    private readonly classRepository: IClassRepository;
    private readonly subjectMapper:   SubjectMapper;

    constructor({ classRepository, subjectMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.subjectMapper   = subjectMapper;
    }

    async execute(
        dto: CreateSubjectDtoType,
    ): Promise<SubjectResponseData> {
        if (dto.code) {
            const existing = await this.classRepository
                .findSubjectByCode(dto.code);

            if (existing) {
                throw new ConflictError(ClassErrorMessage.SUBJECT_CODE_TAKEN);
            }
        }

        const subject = await this.classRepository.createSubject(dto);
        return this.subjectMapper.toResponse(subject);
    }
}