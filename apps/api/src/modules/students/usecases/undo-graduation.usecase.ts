import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentResponseData } from "../mappers/student.mapper";
import { StudentPhotoService } from "../services/student-photo.service";
import { studentErrors } from "../domain/student.errors";
import { StudentActor } from "../domain/student.types";
import { UndoGraduationDtoType } from "../dtos/student.dto";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { lockClass, activeInClass, wouldOverflow } from "../../enrolment/services/class-seats";

interface Dependencies { studentRepository: IStudentRepository; sessionRepository: ISessionRepository; studentPhotoService: StudentPhotoService; auditService: AuditService; }

/*
| UNDO A GRADUATION (correcting a mistaken promotion run). Audited, and a reason is always required.
|  - The student must really be graduated.
|  - They count toward the plan again, so there must be room for one more student (checked first). A student who
|    is inactive does not count either way, so no room is needed.
|  - Optionally `reopenEnrolment` puts them back in their final class. That is only allowed while the term they
|    graduated from is still the current term, the student is active, the old enrolment exists, and the class has
|    a free seat (checked under the class lock). Otherwise: undo without reopening and enrol them normally.
|  - All changes happen in one transaction. Nothing is erased: enrolments, results and fees are untouched.
*/
export class UndoGraduationUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UndoGraduationDtoType, actor: StudentActor): Promise<StudentResponseData> {
        const d = this.d;
        const student = await d.studentRepository.findById(id);
        if (!student) throw studentErrors.notFound();
        if (!student.graduatedAt) throw studentErrors.notGraduated();

        const graduatedTerm = student.graduatedTermId ? await d.sessionRepository.findTermById(student.graduatedTermId) : null;
        if (dto.reopenEnrolment) {
            if (!student.isActive) throw studentErrors.reopenInactive();
            if (!graduatedTerm?.isCurrent) throw studentErrors.reopenTermNotCurrent();
        }
        if (student.isActive) await assertWithinPlanLimit(schoolId, "student", 1);

        let reopenedClass: string | null = null;
        await getTenantClient().$transaction(async tx => {
            if (dto.reopenEnrolment) {
                const old = await tx.enrolment.findFirst({ where: { studentId: id, termId: student.graduatedTermId!, status: "completed" }, select: { id: true, classId: true } });
                if (!old) throw studentErrors.reopenNotFound();
                await lockClass(tx as any, old.classId);
                const cls = await tx.class.findUnique({ where: { id: old.classId }, select: { name: true, capacity: true } });
                const enrolled = await activeInClass(tx as any, old.classId, student.graduatedTermId!);
                if (wouldOverflow(cls?.capacity, enrolled, 1)) throw studentErrors.reopenClassFull(cls?.name ?? "The class");
                await tx.enrolment.update({ where: { id: old.id }, data: { status: "active" } });
                reopenedClass = cls?.name ?? null;
            }
            // Only if still graduated: two people undoing at once cannot both succeed.
            const done = await tx.student.updateMany({ where: { id, graduatedAt: { not: null } }, data: { graduatedAt: null, graduatedTermId: null } });
            if (done.count === 0) throw studentErrors.notGraduated();
        }, { maxWait: 5000, timeout: 30000 });

        const termLabel = graduatedTerm ? `${graduatedTerm.name}` : null;
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.graduation_undone", entity: "Student", entityId: id,
            oldValue: { name: `${student.firstName} ${student.lastName}`, graduatedAt: student.graduatedAt.toISOString(), graduatedTerm: termLabel },
            newValue: { reason: dto.reason, reopenedEnrolment: !!reopenedClass, class: reopenedClass },
        });
        return d.studentPhotoService.toResponse((await d.studentRepository.findById(id))!);
    }
}
