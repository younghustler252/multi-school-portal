import { IClassRepository }  from "../../repositories/class.repository";
import { NotFoundError }     from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage } from "../../domain/class.enums";

interface Dependencies {
    classRepository: IClassRepository;
}

export class RemoveSubjectUseCase {
    private readonly classRepository: IClassRepository;

    constructor({ classRepository }: Dependencies) {
        this.classRepository = classRepository;
    }

    async execute(classSubjectId: string): Promise<void> {
        const existing = await this.classRepository.findClassSubjectById(classSubjectId);

        if (!existing) {
            throw new NotFoundError(ClassErrorMessage.CLASS_SUBJECT_NOT_FOUND);
        }

        await this.classRepository.removeSubject(classSubjectId);
    }
}