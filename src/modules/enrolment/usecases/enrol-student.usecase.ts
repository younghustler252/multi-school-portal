import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { IEnrolmentRepository } from "../repositories/enrolment.repository";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { EnrolmentPresenter, EnrolmentResponse } from "../services/enrolment-presenter";
import { lockClass, activeInClass, wouldOverflow } from "../services/class-seats";
import { enrolmentErrors } from "../domain/enrolment.errors";
import { EnrolmentActor } from "../domain/enrolment.types";
import { EnrolStudentDtoType } from "../dtos/enrolment.dto";

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository; studentRepository: IStudentRepository; classRepository: IClassRepository;
    sessionRepository: ISessionRepository; enrolmentPresenter: EnrolmentPresenter; auditService: AuditService;
}

/*
| ENROL ONE STUDENT in a class for a term. The student must be active, the class and term must exist, and a student
| has ONE enrolment per term (the existing one is named in the error). A class with a capacity may not go over it:
| the count and the save happen together while the class row is locked, so two requests cannot both take the last seat.
*/
export class EnrolStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: EnrolStudentDtoType, actor: EnrolmentActor): Promise<EnrolmentResponse> {
        const d = this.d;
        const student = await d.studentRepository.findById(dto.studentId);
        if (!student) throw enrolmentErrors.studentNotFound();
        if (!student.isActive) throw enrolmentErrors.studentInactive();
        const cls = await d.classRepository.findClassById(dto.classId);
        if (!cls) throw enrolmentErrors.classNotFound();
        if (!(await d.sessionRepository.findTermById(dto.termId))) throw enrolmentErrors.termNotFound();

        const clash = async () => {
            const existing = await d.enrolmentRepository.findByStudentAndTerm(dto.studentId, dto.termId);
            if (!existing) return null;
            const classes = await d.enrolmentPresenter.classMap();
            return enrolmentErrors.alreadyEnrolled({ status: existing.status, class: classes.get(existing.classId)?.name ?? "another class" });
        };
        const already = await clash();
        if (already) throw already;

        let created;
        try {
            created = await getTenantClient().$transaction(async tx => {
                await lockClass(tx as any, dto.classId);
                const enrolled = await activeInClass(tx as any, dto.classId, dto.termId);
                if (wouldOverflow(cls.capacity, enrolled, 1)) throw enrolmentErrors.classFull({ capacity: cls.capacity!, enrolled, requested: 1 });
                return tx.enrolment.create({ data: { studentId: dto.studentId, classId: dto.classId, termId: dto.termId, status: "active" } });
            });
        } catch (err: any) {
            if (err?.code === "P2002") throw (await clash()) ?? err;      // someone enrolled the same student a moment ago
            throw err;
        }

        const shown = await d.enrolmentPresenter.one(created);
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "enrolment.created", entity: "Enrolment", entityId: created.id,
            newValue: { student: shown.student.name, class: shown.class.name, term: shown.term ? `${shown.term.session?.name ?? ""} ${shown.term.name}`.trim() : null },
        });
        return shown;
    }
}
