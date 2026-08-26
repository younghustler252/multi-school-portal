import { IClassRepository }   from "../../repositories/class.repository";
import { SubjectMapper }      from "../../mappers/class.mapper";
import { SubjectResponseData } from "../../types/class.types";

interface Dependencies {
    classRepository: IClassRepository;
    subjectMapper:   SubjectMapper;
}

export class GetSubjectsUseCase {
    private readonly classRepository: IClassRepository;
    private readonly subjectMapper:   SubjectMapper;

    constructor({ classRepository, subjectMapper }: Dependencies) {
        this.classRepository = classRepository;
        this.subjectMapper   = subjectMapper;
    }

    async execute(): Promise<SubjectResponseData[]> {
        const subjects = await this.classRepository.findAllSubjects();
        return subjects.map(s => this.subjectMapper.toResponse(s));
    }
}