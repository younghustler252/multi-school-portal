import { IGuardianRepository } from "../repositories/guardian.repository";
import { IStudentRepository }  from "../../students/repositories/student.repository";
import { StudentMapper }       from "../../students/mappers/student.mapper";
import { NotFoundError }       from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    studentRepository:  IStudentRepository;
    studentMapper:      StudentMapper;
}

export interface MyChildResponseData {
    studentId: string;
    relation:  string;
    isPrimary: boolean;
    firstName: string;
    lastName:  string;
    photoUrl:  string | null;
    isActive:  boolean;
}

export class GetMyChildrenUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly studentRepository:  IStudentRepository;
    private readonly studentMapper:      StudentMapper;

    constructor({ guardianRepository, studentRepository, studentMapper }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.studentRepository  = studentRepository;
        this.studentMapper      = studentMapper;
    }

    async execute(userId: string): Promise<MyChildResponseData[]> {
        const guardian = await this.guardianRepository.findByUserId(userId);

        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        const links = await this.guardianRepository.findStudentLinksByGuardianId(guardian.id);

        const children = await Promise.all(
            links.map(async link => {
                const student = await this.studentRepository.findById(link.studentId);
                if (!student) return null;

                return {
                    studentId: student.id,
                    relation:  link.relation,
                    isPrimary: link.isPrimary,
                    firstName: student.firstName,
                    lastName:  student.lastName,
                    photoUrl:  student.photoUrl,
                    isActive:  student.isActive,
                };
            }),
        );

        return children.filter((c): c is NonNullable<typeof c> => c !== null);
    }
}