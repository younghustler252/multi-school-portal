import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { wouldOverflow } from "../../enrolment/services/class-seats";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentResponseData } from "../mappers/student.mapper";
import { StudentPhotoService } from "../services/student-photo.service";
import { requireUsableBranch } from "../services/student-branch";
import { studentErrors } from "../domain/student.errors";
import { planTransfer } from "../domain/student-transfer.policy";
import { StudentActor } from "../domain/student.types";
import { TransferStudentDtoType } from "../dtos/student.dto";

interface Dependencies { studentRepository: IStudentRepository; studentPhotoService: StudentPhotoService; sessionRepository: ISessionRepository; auditService: AuditService }

export interface TransferResult {
    student: StudentResponseData;
    transfer: { id: string; fromBranch: { id: string; name: string }; toBranch: { id: string; name: string }; fromClass: string | null; toClass: string | null; reason: string; createdAt: Date };
}

/*
|--------------------------------------------------------------------------
| TRANSFER A STUDENT TO ANOTHER BRANCH (students.transfer, school-wide). The only way a student changes branch.
| In ONE transaction: the student's branch changes, their place in the current term moves to the chosen class of the
| new branch (room is checked while the class is locked), and a permanent transfer record is written (who, when, from
| and to, why). Past terms are not touched. The rules are in domain/student-transfer.policy.ts.
| Money records (invoices, payments) keep the branch they were created under: finance is handled separately.
|--------------------------------------------------------------------------
*/
export class TransferStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, studentId: string, dto: TransferStudentDtoType, actor: StudentActor): Promise<TransferResult> {
        const d = this.d;
        const student = await d.studentRepository.findById(studentId);
        if (!student) throw studentErrors.notFound();
        const toBranch = await requireUsableBranch(dto.toBranchId);
        const fromBranch = await d.studentRepository.findBranchRef(student.branchId);

        const term = await d.sessionRepository.findCurrentTerm();
        const enrolment = term ? await d.studentRepository.findActiveEnrolment(studentId, term.id) : null;
        const targetClass = dto.classId ? await d.studentRepository.findClassForTransfer(dto.classId) : null;
        const plan = planTransfer({ student, toBranchId: toBranch.id, classId: dto.classId, enrolment, targetClass });

        const names = await d.studentRepository.classNames([plan.moveEnrolment?.fromClassId, plan.moveEnrolment?.toClassId].filter((x): x is string => !!x));

        const record = await d.studentRepository.transaction(async tx => {
            // The student must still be where we read them (two transfers at once cannot both win).
            if (!(await tx.moveBranch(studentId, student.branchId, toBranch.id))) throw studentErrors.transferConflict();
            if (plan.moveEnrolment) {
                const m = plan.moveEnrolment;
                const enrolled = await tx.lockAndCount(m.toClassId, term!.id);
                if (wouldOverflow(targetClass!.capacity, enrolled, 1)) throw studentErrors.transferClassFull(targetClass!.name);
                if (!(await tx.moveEnrolment(m.enrolmentId, m.fromClassId, m.toClassId))) throw studentErrors.transferConflict();
            }
            return tx.recordTransfer({
                studentId, fromBranchId: student.branchId, toBranchId: toBranch.id, termId: plan.moveEnrolment ? term!.id : null,
                enrolmentId: plan.moveEnrolment?.enrolmentId ?? null, fromClassId: plan.moveEnrolment?.fromClassId ?? null, toClassId: plan.moveEnrolment?.toClassId ?? null,
                reason: dto.reason, transferredById: actor.userId,
            });
        });

        const fromClass = plan.moveEnrolment ? names.get(plan.moveEnrolment.fromClassId) ?? null : null;
        const toClass = plan.moveEnrolment ? names.get(plan.moveEnrolment.toClassId) ?? null : null;
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.branch_transferred", entity: "Student", entityId: studentId,
            oldValue: { branch: fromBranch?.name ?? null, class: fromClass }, newValue: { branch: toBranch.name, class: toClass, reason: dto.reason },
        });
        const updated = (await d.studentRepository.findById(studentId))!;
        return {
            student: await d.studentPhotoService.toResponse(updated),
            transfer: { id: record.id, fromBranch: { id: fromBranch?.id ?? student.branchId, name: fromBranch?.name ?? "" }, toBranch, fromClass, toClass, reason: record.reason, createdAt: record.createdAt },
        };
    }
}
