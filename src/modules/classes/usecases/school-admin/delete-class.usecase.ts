import { IClassRepository }  from "../../repositories/class.repository";
import { ClassMapper }       from "../../mappers/class.mapper";
import { ClassResponseData } from "../../types/class.types";
import { NotFoundError }     from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage } from "../../domain/class.enums";

interface Dependencies {
    classRepository: IClassRepository;
    classMapper:     ClassMapper;
}

export class DeleteClassUseCase {
    private readonly classRepository: IClassRepository;
    private readonly classMapper:     ClassMapper;

    constructor({ classRepository, classMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.classMapper     = classMapper;
    }

    async execute(id: string): Promise<ClassResponseData> {
        const cls = await this.classRepository.findClassById(id);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        const deleted = await this.classRepository.deleteClass(id);
        return this.classMapper.toResponse(deleted);
    }
}