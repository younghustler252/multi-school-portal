import { IGuardianRepository }  from "../repositories/guardian.repository";
import { IStudentRepository }   from "../../students/repositories/student.repository";
import { GuardianMapper }       from "../mappers/guardian.mapper";
import { GuardianWithStudentsResponseData } from "../mappers/guardian.mapper";
import { StudentMapper }        from "../../students/mappers/student.mapper";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    guardianMapper:     GuardianMapper;
    studentRepository:  IStudentRepository;
    studentMapper:      StudentMapper;
}

export class GetGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly guardianMapper:     GuardianMapper;
    private readonly studentRepository:  IStudentRepository;
    private readonly studentMapper:      StudentMapper;

    constructor({
        guardianRepository,
        guardianMapper,
        studentRepository,
        studentMapper,
    }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.guardianMapper     = guardianMapper;
        this.studentRepository  = studentRepository;
        this.studentMapper      = studentMapper;
    }

    async execute(id: string): Promise<GuardianWithStudentsResponseData> {
        const guardian = await this.guardianRepository.findById(id);

        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        const links = await this.guardianRepository.findStudentLinksByGuardianId(id);

        const students = await Promise.all(
            links.map(async link => {
                const student = await this.studentRepository.findById(link.studentId);
                if (!student) return null;

                return {
                    ...this.studentMapper.toResponse(student),
                    relation:  link.relation,
                    isPrimary: link.isPrimary,
                };
            }),
        );

        return {
            ...this.guardianMapper.toResponse(guardian),
            students: students.filter((s): s is NonNullable<typeof s> => s !== null),
        };
    }
}