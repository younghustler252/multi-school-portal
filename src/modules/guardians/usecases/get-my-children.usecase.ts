import { IGuardianRepository } from "../repositories/guardian.repository";
import { IStudentRepository }  from "../../students/repositories/student.repository";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { ISessionRepository }   from "../../sessions/repositories/session.repository";
import { IClassRepository }     from "../../classes/repositories/class.repository";
import { NotFoundError }       from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    studentRepository:  IStudentRepository;
    enrolmentRepository: IEnrolmentRepository;
    sessionRepository:   ISessionRepository;
    classRepository:     IClassRepository;
}

export interface MyChildResponseData {
    studentId:  string;
    relation:   string;
    isPrimary:  boolean;
    firstName:  string;
    lastName:   string;
    photoUrl:   string | null;
    isActive:   boolean;
    classId:    string | null;
    className:  string | null;
}

export class GetMyChildrenUseCase {
    private readonly guardianRepository:  IGuardianRepository;
    private readonly studentRepository:   IStudentRepository;
    private readonly enrolmentRepository: IEnrolmentRepository;
    private readonly sessionRepository:   ISessionRepository;
    private readonly classRepository:     IClassRepository;

    constructor({
        guardianRepository,
        studentRepository,
        enrolmentRepository,
        sessionRepository,
        classRepository,
    }: Dependencies) {
        this.guardianRepository  = guardianRepository;
        this.studentRepository   = studentRepository;
        this.enrolmentRepository = enrolmentRepository;
        this.sessionRepository   = sessionRepository;
        this.classRepository     = classRepository;
    }

    async execute(userId: string): Promise<MyChildResponseData[]> {
        const guardian = await this.guardianRepository.findByUserId(userId);

        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        const currentTerm = await this.sessionRepository.findCurrentTerm();
        const links = await this.guardianRepository.findStudentLinksByGuardianId(guardian.id);

        const children = await Promise.all(
            links.map(async link => {
                const student = await this.studentRepository.findById(link.studentId);
                if (!student) return null;

                let classId:   string | null = null;
                let className: string | null = null;

                if (currentTerm) {
                    const enrolment = await this.enrolmentRepository.findByStudentAndTerm(
                        student.id,
                        currentTerm.id,
                    );

                    if (enrolment) {
                        const cls = await this.classRepository.findClassById(enrolment.classId);
                        classId   = enrolment.classId;
                        className = cls?.name ?? null;
                    }
                }

                return {
                    studentId: student.id,
                    relation:  link.relation,
                    isPrimary: link.isPrimary,
                    firstName: student.firstName,
                    lastName:  student.lastName,
                    photoUrl:  student.photoUrl,
                    isActive:  student.isActive,
                    classId,
                    className,
                };
            }),
        );

        return children.filter((c): c is NonNullable<typeof c> => c !== null);
    }
}