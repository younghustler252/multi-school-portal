import { IStudentRepository }   from "../repositories/student.repository";
import { StudentMapper }        from "../mappers/student.mapper";
import { StudentResponseData }  from "../mappers/student.mapper";
import { ConflictError }        from "../../../shared/errors/domain.errors";
import { StudentErrorMessage }  from "../domain/student.enums";
import { CreateStudentDtoType } from "../dtos/student.dto";

/*
|--------------------------------------------------------------------------
| CREATE STUDENT USE CASE
| Flow:
| 1. Check admission number not taken
| 2. Create student record
| 3. If guardian info provided — create guardian record
|--------------------------------------------------------------------------
*/

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper:     StudentMapper;
}

export class CreateStudentUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper:     StudentMapper;

    constructor({ studentRepository, studentMapper }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper     = studentMapper;
    }

    async execute(
        dto: CreateStudentDtoType,
    ): Promise<StudentResponseData> {

        // ── 1. Check admission number not taken ───────────────────────────
        if (dto.admissionNumber) {
            const existing = await this.studentRepository
                .findByAdmissionNumber(dto.admissionNumber);

            if (existing) {
                throw new ConflictError(
                    StudentErrorMessage.ADMISSION_NUMBER_TAKEN,
                );
            }
        }

        // ── 2. Create student record ──────────────────────────────────────
        const student = await this.studentRepository.create({
            firstName:       dto.firstName,
            lastName:        dto.lastName,
            middleName:      dto.middleName,
            admissionNumber: dto.admissionNumber,
            dateOfBirth:     dto.dateOfBirth
                                 ? new Date(dto.dateOfBirth)
                                 : null,
            gender:          dto.gender,
            bloodGroup:      dto.bloodGroup,
            address:         dto.address,
            religion:        dto.religion,
            nationality:     dto.nationality ?? "Nigerian",
            stateOfOrigin:   dto.stateOfOrigin,
            admittedAt:      dto.admittedAt
                                 ? new Date(dto.admittedAt)
                                 : new Date(),
        });


        return this.studentMapper.toResponse(student);
    }
}