import { IClassRepository } from "../../repositories/class.repository";

interface Dependencies {
    classRepository: IClassRepository;
}

export class SetClassProgressionUseCase {
    private readonly classRepository: IClassRepository;

    constructor({ classRepository }: Dependencies) {
        this.classRepository = classRepository;
    }

    async execute(
        fromClassId: string,
        toClassId: string | null,
    ) {
        return this.classRepository.setClassProgression({
            fromClassId,
            toClassId,
        });
    }
}
