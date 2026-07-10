import { IStudentRepository }  from "../repositories/student.repository";
import { StudentMapper }       from "../mappers/student.mapper";
import { StudentResponseData } from "../mappers/student.mapper";
import { NotFoundError }       from "../../../shared/errors/domain.errors";
import { StudentErrorMessage } from "../domain/student.enums";

/*
|--------------------------------------------------------------------------
| DEACTIVATE STUDENT USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper:     StudentMapper;
}

export class DeactivateStudentUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper:     StudentMapper;

    constructor({ studentRepository, studentMapper }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper     = studentMapper;
    }

    async execute(id: string): Promise<StudentResponseData> {
        const student = await this.studentRepository.findById(id);

        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        const updated = await this.studentRepository.update(id, {
            isActive: false,
        });

        return this.studentMapper.toResponse(updated);
    }
}