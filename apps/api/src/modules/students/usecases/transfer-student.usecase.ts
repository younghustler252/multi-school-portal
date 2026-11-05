import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { lockClass, activeInClass, wouldOverflow } from "../../enrolment/services/class-seats";
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
    /** Money the student still owes. It stays with the branch it was billed in; the school may want to follow it up. */
    finance: { openInvoices: number; outstandingKobo: number };
    transfer: { id: string; fromBranch: { id: string; name: string }; toBranch: { id: string; name: string }; fromClass: string | null; toClass: string | null; reason: string; createdAt: Date };
}

/*
|--------------------------------------------------------------------------
| TRANSFER A STUDENT TO ANOTHER BRANCH (students.transfer, school-wide). The only way a student changes branch.
| In ONE transaction: the student's branch changes, their place in the current term moves to the chosen class of the
| new branch (room is checked while the class is locked), and a permanent transfer record is written (who, when, from
| and to, why). Past terms are not touched. The rules are in domain/student-transfer.policy.ts.
| Money records (invoices, payments) keep the branch they were created under (that is where the money was earned). The result
| tells the school how much the student still owes, so someone can follow it up.
|--------------------------------------------------------------------------
*/
export class TransferStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, studentId: string, dto: TransferStudentDtoType, actor: StudentActor): Promise<TransferResult> {
        const d = this.d, db = getTenantClient();
        const student = await d.studentRepository.findById(studentId);
        if (!student) throw studentErrors.notFound();
        const toBranch = await requireUsableBranch(dto.toBranchId);
        const fromBranch = await db.branch.findUnique({ where: { id: student.branchId }, select: { id: true, name: true } });

        const term = await d.sessionRepository.findCurrentTerm();
        const enrolment = term ? await db.enrolment.findFirst({ where: { studentId, termId: term.id, status: "active" }, select: { id: true, classId: true } }) : null;
        const targetClass = dto.classId ? await db.class.findUnique({ where: { id: dto.classId }, select: { id: true, name: true, branchId: true, capacity: true } }) : null;
        const plan = planTransfer({ student, toBranchId: toBranch.id, classId: dto.classId, enrolment, targetClass });

        const names = new Map((await db.class.findMany({ where: { id: { in: [plan.moveEnrolment?.fromClassId, plan.moveEnrolment?.toClassId].filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map(c => [c.id, c.name]));

        const record = await db.$transaction(async tx => {
            // The student must still be where we read them (two transfers at once cannot both win).
            const moved = await tx.student.updateMany({ where: { id: studentId, branchId: student.branchId, graduatedAt: null }, data: { branchId: toBranch.id } });
            if (moved.count !== 1) throw studentErrors.transferConflict();
            if (plan.moveEnrolment) {
                const m = plan.moveEnrolment;
                await lockClass(tx as any, m.toClassId);
                const enrolled = await activeInClass(tx as any, m.toClassId, term!.id);
                if (wouldOverflow(targetClass!.capacity, enrolled, 1)) throw studentErrors.transferClassFull(targetClass!.name);
                const done = await tx.enrolment.updateMany({ where: { id: m.enrolmentId, classId: m.fromClassId, status: "active" }, data: { classId: m.toClassId } });
                if (done.count !== 1) throw studentErrors.transferConflict();
            }
            return tx.studentBranchTransfer.create({ data: {
                studentId, fromBranchId: student.branchId, toBranchId: toBranch.id, termId: plan.moveEnrolment ? term!.id : null,
                enrolmentId: plan.moveEnrolment?.enrolmentId ?? null, fromClassId: plan.moveEnrolment?.fromClassId ?? null, toClassId: plan.moveEnrolment?.toClassId ?? null,
                reason: dto.reason, transferredById: actor.userId,
            } });
        });

        const fromClass = plan.moveEnrolment ? names.get(plan.moveEnrolment.fromClassId) ?? null : null;
        const toClass = plan.moveEnrolment ? names.get(plan.moveEnrolment.toClassId) ?? null : null;
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.branch_transferred", entity: "Student", entityId: studentId,
            oldValue: { branch: fromBranch?.name ?? null, class: fromClass }, newValue: { branch: toBranch.name, class: toClass, reason: dto.reason },
        });
        const updated = (await d.studentRepository.findById(studentId))!;
        const owed = await db.feeInvoice.aggregate({ where: { studentId, voidedAt: null, status: { in: ["unpaid", "partial"] } }, _count: { _all: true }, _sum: { balanceKobo: true } });
        return {
            student: await d.studentPhotoService.toResponse(updated),
            finance: { openInvoices: owed._count._all, outstandingKobo: Number(owed._sum.balanceKobo ?? 0n) },
            transfer: { id: record.id, fromBranch: { id: fromBranch?.id ?? student.branchId, name: fromBranch?.name ?? "" }, toBranch, fromClass, toClass, reason: record.reason, createdAt: record.createdAt },
        };
    }
}
