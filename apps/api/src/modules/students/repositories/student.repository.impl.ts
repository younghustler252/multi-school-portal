import { BaseTenantRepository, PaginateParams, PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { StudentMapper } from "../mappers/student.mapper";
import { StudentEntity } from "../domain/student.entity";
import { IStudentRepository, UndoGraduationOutcome, StudentTx } from "./student.repository";
import { createOrReuseGuardianInTx } from "../../guardians/services/guardian-linking";
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

    transaction<T>(work: (tx: StudentTx) => Promise<T>, limits = { maxWait: 5000, timeout: 30000 }): Promise<T> {
        return this.prisma.$transaction(async raw => work({
            lockAndCount: async (classId, termId) => { await lockClass(raw as any, classId); return activeInClass(raw as any, classId, termId); },
            createStudent: async (data, generate) => raw.student.create({ data: { ...(data as any), admissionNumber: (data as any).admissionNumber ?? await generate(raw) } }),
            enrol: async (studentId, classId, termId) => { await raw.enrolment.create({ data: { studentId, classId, termId, status: "active" } }); },
            linkGuardian: (guardian, link) => createOrReuseGuardianInTx(raw as any, guardian, link),
            moveBranch: async (studentId, fromBranchId, toBranchId) =>
                (await raw.student.updateMany({ where: { id: studentId, branchId: fromBranchId, graduatedAt: null }, data: { branchId: toBranchId } })).count === 1,
            moveEnrolment: async (enrolmentId, fromClassId, toClassId) =>
                (await raw.enrolment.updateMany({ where: { id: enrolmentId, classId: fromClassId, status: "active" }, data: { classId: toClassId } })).count === 1,
            recordTransfer: data => raw.studentBranchTransfer.create({ data: data as any }),
        }), limits);
    }

    findCurrentTermRef() { return this.prisma.term.findFirst({ where: { isCurrent: true }, select: { id: true, name: true } }); }

    async classesWithPlaces(termId: string | null) {
        const classes = await this.prisma.class.findMany({ select: { id: true, name: true, capacity: true } });
        const grouped = termId ? await this.prisma.enrolment.groupBy({ by: ["classId"], where: { termId, status: { in: ["active", "completed"] } }, _count: { _all: true } }) : [];
        const by = new Map(grouped.map(g => [g.classId, g._count._all]));
        return classes.map(c => ({ ...c, enrolled: by.get(c.id) ?? 0 }));
    }

    async takenAdmissionNumbers(numbers: string[]): Promise<string[]> {
        if (!numbers.length) return [];
        const rows = await this.prisma.student.findMany({ where: { admissionNumber: { in: numbers } }, select: { admissionNumber: true } });
        return rows.map(r => r.admissionNumber!).filter(Boolean);
    }

    peopleBornBetween(from: Date, to: Date) {
        return this.prisma.student.findMany({ where: { dateOfBirth: { gte: from, lt: to } }, select: { firstName: true, lastName: true, dateOfBirth: true } });
    }

    findBranchRef(id: string) { return this.prisma.branch.findUnique({ where: { id }, select: { id: true, name: true } }); }

    findActiveEnrolment(studentId: string, termId: string) {
        return this.prisma.enrolment.findFirst({ where: { studentId, termId, status: "active" }, select: { id: true, classId: true } });
    }

    findClassForTransfer(id: string) { return this.prisma.class.findUnique({ where: { id }, select: { id: true, name: true, branchId: true, capacity: true } }); }

    async classNames(ids: string[]): Promise<Map<string, string>> {
        if (!ids.length) return new Map();
        const rows = await this.prisma.class.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
        return new Map(rows.map(c => [c.id, c.name]));
    }
}
