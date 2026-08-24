import { IClassRepository }  from "../../repositories/class.repository";
import { ClassResponseData, ClassMapper } from "../../mappers/class.mapper";
import { NotFoundError }     from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage } from "../../domain/class.enums";

interface Dependencies {
    classRepository: IClassRepository;
    classMapper:     ClassMapper;
}

export class GetClassByIdUseCase {
    private readonly classRepository: IClassRepository;
    private readonly classMapper:     ClassMapper;

    constructor({ classRepository, classMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.classMapper     = classMapper;
    }

    async execute(id: string): Promise<ClassResponseData> {
        const cls = await this.classRepository.findClassById(id);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);
        return this.classMapper.toResponse(cls);
    }
}