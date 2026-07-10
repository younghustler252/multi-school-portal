import { IClassRepository }   from "../../repositories/class.repository";
import { ClassMapper }        from "../../mappers/class.mapper";
import { ClassResponseData }  from "../../mappers/class.mapper";
import { ConflictError }      from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }  from "../../domain/class.enums";
import { CreateClassDtoType } from "../../dtos/class.dto";

interface Dependencies {
    classRepository: IClassRepository;
    classMapper:     ClassMapper;
}

export class CreateClassUseCase {
    private readonly classRepository: IClassRepository;
    private readonly classMapper:     ClassMapper;

    constructor({ classRepository, classMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.classMapper     = classMapper;
    }

    async execute(dto: CreateClassDtoType): Promise<ClassResponseData> {
        const existing = await this.classRepository.findClassByName(dto.name);
        if (existing) {
            throw new ConflictError(ClassErrorMessage.NAME_TAKEN);
        }

        const cls = await this.classRepository.createClass(dto);
        return this.classMapper.toResponse(cls);
    }
}