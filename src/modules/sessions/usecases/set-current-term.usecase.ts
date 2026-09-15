import { ISessionRepository }   from "../repositories/session.repository";
import { TermMapper }           from "../mappers/session.mapper";
import { TermResponseData }     from "../mappers/session.mapper";
import { IEnrolmentRepository } from "../../enrolment/repositories/enrolment.repository";
import { IStudentRepository }   from "../../students/repositories/student.repository";
import { NotFoundError }         from "../../../shared/errors/domain.errors";
import { SessionErrorMessage }   from "../domain/session.enums";

interface Dependencies {
    sessionRepository:   ISessionRepository;
    enrolmentRepository: IEnrolmentRepository;
    studentRepository:   IStudentRepository;
    termMapper:          TermMapper;
}

export class SetCurrentTermUseCase {
    private readonly sessionRepository:   ISessionRepository;
    private readonly enrolmentRepository: IEnrolmentRepository;
    private readonly studentRepository:   IStudentRepository;
    private readonly termMapper:          TermMapper;

    constructor({
        sessionRepository,
        enrolmentRepository,
        studentRepository,
        termMapper,
    }: Dependencies) {
        this.sessionRepository   = sessionRepository;
        this.enrolmentRepository = enrolmentRepository;
        this.studentRepository   = studentRepository;
        this.termMapper          = termMapper;
    }

    async execute(termId: string): Promise<TermResponseData> {
        const term = await this.sessionRepository.findTermById(termId);

        if (!term) {
            throw new NotFoundError(
                SessionErrorMessage.TERM_NOT_FOUND,
            );
        }

        const updated = await this.sessionRepository.setCurrentTerm(termId);

        const previousTerm =
            await this.sessionRepository.findPreviousTermInSession(
                updated.sessionId,
                updated.id,
            );

        if (previousTerm) {
            const previousEnrolments =
                await this.enrolmentRepository.findMany({
                    termId: previousTerm.id,
                    status: "active",
                });

            for (const enrolment of previousEnrolments) {
                const exists =
                    await this.enrolmentRepository.findByStudentAndTerm(
                        enrolment.studentId,
                        updated.id,
                    );

                if (exists) continue;

                const student =
                    await this.studentRepository.findById(
                        enrolment.studentId,
                    );

                if (!student?.isActive) continue;

                await this.enrolmentRepository.create({
                    studentId: enrolment.studentId,
                    classId: enrolment.classId,
                    termId: updated.id,
                    status: "active",
                });
            }
        }

        return this.termMapper.toResponse(updated);
    }
}
