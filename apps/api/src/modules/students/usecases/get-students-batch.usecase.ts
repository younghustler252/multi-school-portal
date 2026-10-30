import { IStudentRepository }  from "../repositories/student.repository";
import { StudentMapper }       from "../mappers/student.mapper";
import { StudentResponseData } from "../mappers/student.mapper";

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper:     StudentMapper;
}

export class GetStudentsBatchUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper:     StudentMapper;

    constructor({ studentRepository, studentMapper }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper     = studentMapper;
    }

    async execute(ids: string[]): Promise<StudentResponseData[]> {
        if (ids.length === 0) return [];

        const students = await this.studentRepository.findMany({ id: { in: ids } });
        return students.map(s => this.studentMapper.toResponse(s));
    }
}