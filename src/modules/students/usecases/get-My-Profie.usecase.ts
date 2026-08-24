import { IStudentRepository }  from "../repositories/student.repository";
import { IGuardianRepository } from "../../guardians/repositories/guardian.repository";
import { StudentMapper }       from "../mappers/student.mapper";
import { StudentWithGuardiansResponseData } from "../mappers/student.mapper";
import { GuardianMapper }      from "../../guardians/mappers/guardian.mapper";
import { NotFoundError }       from "../../../shared/errors/domain.errors";
import { StudentErrorMessage } from "../domain/student.enums";

interface Dependencies {
    studentRepository:  IStudentRepository;
    studentMapper:      StudentMapper;
    guardianRepository: IGuardianRepository;
    guardianMapper:     GuardianMapper;
}

export class GetMyProfileUseCase {
    private readonly studentRepository:  IStudentRepository;
    private readonly studentMapper:      StudentMapper;
    private readonly guardianRepository: IGuardianRepository;
    private readonly guardianMapper:     GuardianMapper;

    constructor({
        studentRepository,
        studentMapper,
        guardianRepository,
        guardianMapper,
    }: Dependencies) {
        this.studentRepository  = studentRepository;
        this.studentMapper      = studentMapper;
        this.guardianRepository = guardianRepository;
        this.guardianMapper     = guardianMapper;
    }

    async execute(userId: string): Promise<StudentWithGuardiansResponseData> {
        const student = await this.studentRepository.findByUserId(userId);

        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        const links = await this.guardianRepository.findGuardianLinksByStudentId(student.id);

        return {
            ...this.studentMapper.toResponse(student),
            guardians: links.map(link => ({
                ...this.guardianMapper.toResponse(link.guardian),
                relation:  link.relation,
                isPrimary: link.isPrimary,
            })),
        };
    }
}