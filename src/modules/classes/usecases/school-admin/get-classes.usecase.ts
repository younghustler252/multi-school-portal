import { IClassRepository } from "../../repositories/class.repository";
import { ClassMapper } from "../../mappers/class.mapper";
import { ClassResponseData } from "../../types/class.types";

interface Dependencies {
    classRepository: IClassRepository;
    classMapper: ClassMapper;
}

export class GetClassesUseCase {
    private readonly classRepository: IClassRepository;
    private readonly classMapper: ClassMapper;

    constructor({ classRepository, classMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.classMapper = classMapper;
    }

    async execute(termId: string): Promise<ClassResponseData[]> {
        const classes =
            await this.classRepository.findAllClassesEnriched(termId);

        return classes.map((c) => this.classMapper.toResponse(c));
    }
}