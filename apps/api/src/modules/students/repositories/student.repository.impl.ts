import { BaseTenantRepository, PaginateParams, PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { StudentMapper } from "../mappers/student.mapper";
import { StudentEntity } from "../domain/student.entity";
import { IStudentRepository, UndoGraduationOutcome } from "./student.repository";
import { lockClass, activeInClass, wouldOverflow } from "../../enrolment/services/class-seats";

/*
| STUDENT REPOSITORY. Generic reads and writes come from BaseTenantRepository (the same base Staff uses).
| A student is never erased: `isActive` is the business status, so this repository does not use soft delete.
| Other modules (guardians, enrolment, attendance, report cards...) call this interface: keep its method names.
*/
export class StudentRepositoryImpl extends BaseTenantRepository<StudentEntity> implements IStudentRepository {
    protected readonly modelName = "student";

    constructor({ studentMapper }: { studentMapper: StudentMapper }) { super(studentMapper); }

    async findByUserId(userId: string): Promise<StudentEntity | null> { return this.findOne({ userId }); }
    async findByAdmissionNumber(admissionNumber: string): Promise<StudentEntity | null> { return this.findOne({ admissionNumber }); }

    /**
     * Name or admission-number search. Every word typed must match somewhere ("ada obi" finds Ada Obi),
     * and any filters in params.where are KEPT (they used to be thrown away).
     */
    async searchStudents(query: string, params: PaginateParams): Promise<PaginatedResult<StudentEntity>> {
        const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
        const matchesWord = (w: string) => ({
            OR: [
                { firstName:       { contains: w, mode: "insensitive" } },
                { lastName:        { contains: w, mode: "insensitive" } },
                { middleName:      { contains: w, mode: "insensitive" } },
                { admissionNumber: { contains: w, mode: "insensitive" } },
            ],
        });
        return this.paginate({ ...params, where: { AND: [params.where ?? {}, ...words.map(matchesWord)] } });
    }

    async undoGraduation(studentId: string, reopen: { termId: string } | null): Promise<UndoGraduationOutcome> {
        class Abort extends Error { constructor(readonly outcome: UndoGraduationOutcome) { super("abort"); } }
        try {
            return await this.prisma.$transaction(async tx => {
                let reopenedClass: string | null = null;
                if (reopen) {
                    const old = await tx.enrolment.findFirst({ where: { studentId, termId: reopen.termId, status: "completed" }, select: { id: true, classId: true } });
                    if (!old) throw new Abort({ status: "no_enrolment" });
                    await lockClass(tx as any, old.classId);
                    const cls = await tx.class.findUnique({ where: { id: old.classId }, select: { name: true, capacity: true } });
                    const enrolled = await activeInClass(tx as any, old.classId, reopen.termId);
                    if (wouldOverflow(cls?.capacity, enrolled, 1)) throw new Abort({ status: "class_full", className: cls?.name ?? "The class" });
                    await tx.enrolment.update({ where: { id: old.id }, data: { status: "active" } });
                    reopenedClass = cls?.name ?? null;
                }
                // Only if still graduated: two people undoing at once cannot both succeed.
                const done = await tx.student.updateMany({ where: { id: studentId, graduatedAt: { not: null } }, data: { graduatedAt: null, graduatedTermId: null } });
                if (done.count === 0) throw new Abort({ status: "not_graduated" });
                return { status: "ok", reopenedClass } as UndoGraduationOutcome;
            }, { maxWait: 5000, timeout: 30000 });
        } catch (err) {
            if (err instanceof Abort) return err.outcome;   // the transaction was rolled back
            throw err;
        }
    }
}
