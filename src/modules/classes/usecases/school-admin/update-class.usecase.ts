import { IClassRepository }   from "../../repositories/class.repository";
import { ClassMapper }        from "../../mappers/class.mapper";
import { ClassResponseData } from "../../types/class.types";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }  from "../../domain/class.enums";
import { UpdateClassDtoType } from "../../dtos/class.dto";

interface Dependencies {
    classRepository: IClassRepository;
    classMapper:     ClassMapper;
}

export class UpdateClassUseCase {
    private readonly classRepository: IClassRepository;
    private readonly classMapper:     ClassMapper;

    constructor({ classRepository, classMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.classMapper     = classMapper;
    }

    async execute(
        id:  string,
        dto: UpdateClassDtoType,
    ): Promise<ClassResponseData> {
        const cls = await this.classRepository.findClassById(id);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        const updated = await this.classRepository.updateClass(id, dto);
        return this.classMapper.toResponse(updated);
    }
}