import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { IEnrolmentRepository } from "../repositories/enrolment.repository";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { EnrolmentPresenter, EnrolmentResponse } from "../services/enrolment-presenter";
import { lockClass, activeInClass, wouldOverflow } from "../services/class-seats";
import { enrolmentErrors } from "../domain/enrolment.errors";
import { EnrolmentActor } from "../domain/enrolment.types";
import { UpdateEnrolmentDtoType } from "../dtos/enrolment.dto";

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository; studentRepository: IStudentRepository; classRepository: IClassRepository;
    enrolmentPresenter: EnrolmentPresenter; auditService: AuditService;
}


/*
| CHANGE AN ENROLMENT, one of two things per request:
|   status  an ACTIVE enrolment can become withdrawn / transferred / completed; a closed one can only go back to
|           active (the student must be active and the class must have room)
|   classId move an ACTIVE enrolment to another class in the same term (room is checked)
| Every change is audited with names and the optional reason.
*/
export class UpdateEnrolmentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateEnrolmentDtoType, actor: EnrolmentActor): Promise<EnrolmentResponse> {
        const d = this.d;
        const enrolment = await d.enrolmentRepository.findById(id);
        if (!enrolment) throw enrolmentErrors.notFound();
        const before = await d.enrolmentPresenter.one(enrolment);

        let targetClassId = enrolment.classId;
        let data: Record<string, unknown> = {};
        let action = "enrolment.status_changed";

        if (dto.classId !== undefined) {
            if (enrolment.status !== "active") throw enrolmentErrors.notActive();
            if (dto.classId === enrolment.classId) throw enrolmentErrors.sameClass();
            if (!(await d.classRepository.findClassById(dto.classId))) throw enrolmentErrors.classNotFound();
            targetClassId = dto.classId; data = { classId: dto.classId }; action = "enrolment.moved";
        } else if (dto.status !== undefined) {
            if (dto.status === enrolment.status) return before;                       // nothing to change
            const reopening = dto.status === "active";
            if (reopening ? enrolment.status === "active" : enrolment.status !== "active") throw enrolmentErrors.statusInvalid(enrolment.status, dto.status);
            if (reopening) {
                const student = await d.studentRepository.findById(enrolment.studentId);
                if (!student?.isActive) throw enrolmentErrors.studentInactive();
            }
            data = { status: dto.status };
        }

        const needsSeat = "classId" in data || data.status === "active";
        const cls = needsSeat ? await d.classRepository.findClassById(targetClassId) : null;
        const saved = await getTenantClient().$transaction(async tx => {
            if (needsSeat) {
                await lockClass(tx as any, targetClassId);
                const enrolled = await activeInClass(tx as any, targetClassId, enrolment.termId);
                if (wouldOverflow(cls?.capacity, enrolled, 1)) throw enrolmentErrors.classFull({ capacity: cls!.capacity!, enrolled, requested: 1 });
            }
            return tx.enrolment.update({ where: { id }, data: data as any });
        });

        const after = await d.enrolmentPresenter.one(saved);
        await d.auditService.log({
            userId: actor.userId, schoolId, action, entity: "Enrolment", entityId: id,
            oldValue: { student: before.student.name, class: before.class.name, status: before.status },
            newValue: { class: after.class.name, status: after.status, ...(dto.reason ? { reason: dto.reason } : {}) },
        });
        return after;
    }
}
