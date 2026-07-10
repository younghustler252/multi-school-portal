import { IClassRepository }  from "../../repositories/class.repository";
import { ClassMapper }       from "../../mappers/class.mapper";
import { ClassResponseData } from "../../mappers/class.mapper";

interface Dependencies {
    classRepository: IClassRepository;
    classMapper:     ClassMapper;
}

export class GetClassesUseCase {
    private readonly classRepository: IClassRepository;
    private readonly classMapper:     ClassMapper;

    constructor({ classRepository, classMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.classMapper     = classMapper;
    }

    async execute(): Promise<ClassResponseData[]> {
        const classes = await this.classRepository.findAllClasses();
        return classes.map(c => this.classMapper.toResponse(c));
    }
}