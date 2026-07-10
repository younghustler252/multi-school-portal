import { IStudentRepository }   from "../repositories/student.repository";
import { StudentMapper }        from "../mappers/student.mapper";
import { StudentResponseData }  from "../mappers/student.mapper";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { StudentErrorMessage }  from "../domain/student.enums";
import { UpdateStudentDtoType } from "../dtos/student.dto";

/*
|--------------------------------------------------------------------------
| UPDATE STUDENT USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper:     StudentMapper;
}

export class UpdateStudentUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper:     StudentMapper;

    constructor({ studentRepository, studentMapper }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper     = studentMapper;
    }

    async execute(
        id:  string,
        dto: UpdateStudentDtoType,
    ): Promise<StudentResponseData> {

        const student = await this.studentRepository.findById(id);
        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        const updateData: Record<string, any> = { ...dto };

        if (dto.dateOfBirth) {
            updateData.dateOfBirth = new Date(dto.dateOfBirth);
        }
        if (dto.admittedAt) {
            updateData.admittedAt = new Date(dto.admittedAt);
        }

        const updated = await this.studentRepository.update(id, updateData);
        return this.studentMapper.toResponse(updated);
    }
}