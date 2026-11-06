import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import type { Prisma } from "../../../generated/tenant";
import { ENROLMENT_STATUSES } from "./enrolment-statuses";
import { GradeLevel, levelOfClass } from "../domain/grades.policy";
import { SheetPart } from "../domain/sheet.policy";

export interface Band { minScore: number; grade: string; remark: string; isPass: boolean }

const CLASS_SUBJECT_INCLUDE = {
    class:   { select: { id: true, name: true, level: true, classTeacherId: true } },
    subject: { select: { id: true, name: true, code: true } },
    staff:   { select: { id: true, firstName: true, lastName: true } },
    term:    { select: { id: true, name: true, isCurrent: true, session: { select: { id: true, name: true } } } },
} as const;

/* Mark sheet data access (the tenant client follows the request's school). */
export class GradesSheetsRepository {
    private get db() { return getTenantClient(); }

    classSubject(id: string) { return this.db.classSubject.findUnique({ where: { id }, include: CLASS_SUBJECT_INCLUDE }); }
    currentTerm() { return this.db.term.findFirst({ where: { isCurrent: true }, select: { id: true, name: true } }); }

    /** The parts of the score for a class's level: the level's own scheme, else the default. */
    async partsFor(classLevel: string | null): Promise<SheetPart[]> {
        const level: GradeLevel | null = levelOfClass(classLevel);
        const schemes = await this.db.assessmentScheme.findMany({ where: { level: { in: level ? [level] : [] } }, include: { components: { orderBy: { position: "asc" } } } });
        const own = schemes[0] ?? (await this.db.assessmentScheme.findFirst({ where: { level: null }, include: { components: { orderBy: { position: "asc" } } } }));
        return (own?.components ?? []).map(c => ({ position: c.position, name: c.name, kind: c.kind as "ca" | "exam", maxScore: c.maxScore }));
    }

    /** The grading scale for a class's level: the level's own scale, else the default. */
    async bandsFor(classLevel: string | null): Promise<Band[]> {
        const level = levelOfClass(classLevel);
        const own = level ? await this.db.gradingScale.findFirst({ where: { level }, include: { bands: true } }) : null;
        const scale = own ?? (await this.db.gradingScale.findFirst({ where: { level: null }, include: { bands: true } }));
        return (scale?.bands ?? []).map(b => ({ minScore: b.minScore, grade: b.grade, remark: b.remark, isPass: b.isPass }));
    }

    sheetOf(classSubjectId: string) { return this.db.resultSheet.findUnique({ where: { classSubjectId } }); }

    /** Create the sheet for a class-subject, copying the school's scheme for that level. Two people opening it at once get the same sheet. */
    async createSheet(classSubjectId: string, parts: SheetPart[]) {
        try { return await this.db.resultSheet.create({ data: { classSubjectId, components: parts as any } }); }
        catch (e: any) { if (e?.code === "P2002") { const s = await this.sheetOf(classSubjectId); if (s) return s; } throw e; }
    }

    /** Students on the class list for the term (withdrawn and transferred students are not on it), by name. */
    studentsOnList(classId: string, termId: string) {
        return this.db.enrolment.findMany({
            where: { classId, termId, status: { in: [...ENROLMENT_STATUSES] } },
            select: { studentId: true, student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
            orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        });
    }

    gradesOfSheet(sheetId: string) { return this.db.grade.findMany({ where: { sheetId }, include: { scores: true } }); }

    /** Runs `work` in one transaction (the sheet is locked inside by the caller, see lockSheet). */
    transaction<T>(work: (tx: TenantTx) => Promise<T>): Promise<T> {
        return this.db.$transaction(work, { maxWait: 5000, timeout: 30000 });
    }

    /** One page of class-subject rows with their sheet status, plus the total. */
    async sheetsPage(where: Record<string, unknown>, skip: number, take: number) {
        const [total, rows] = await Promise.all([
            this.db.classSubject.count({ where: where as any }),
            this.db.classSubject.findMany({ where: where as any, orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }], skip, take,
                include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } }, staff: { select: { id: true, firstName: true, lastName: true } },
                           term: { select: { id: true, name: true, session: { select: { id: true, name: true } } } }, sheet: { select: { id: true, status: true } } } }),
        ]);
        return { total, rows };
    }

    /** How far along each sheet is: students on each class list, and how many have a complete set of scores (two grouped queries). */
    async sheetProgress(classIds: string[], classSubjectIds: string[], termId: string) {
        const [onList, done] = await Promise.all([
            classIds.length ? this.db.enrolment.groupBy({ by: ["classId"], where: { classId: { in: classIds }, termId, status: { in: ["active", "completed"] } }, _count: { _all: true } }) : [],
            classSubjectIds.length ? this.db.grade.groupBy({ by: ["classSubjectId"], where: { classSubjectId: { in: classSubjectIds }, total: { not: null } }, _count: { _all: true } }) : [],
        ]);
        return { listBy: new Map(onList.map(x => [x.classId, x._count._all])), doneBy: new Map(done.map(x => [x.classSubjectId, x._count._all])) };
    }

    /** One page of results (grades) with scores, sheet, student, class, subject and term, plus the total. */
    async gradesPage(where: Record<string, unknown>, skip: number, take: number) {
        const [total, rows] = await Promise.all([
            this.db.grade.count({ where: where as any }),
            this.db.grade.findMany({ where: where as any, orderBy: [{ term: { startDate: "desc" } }, { createdAt: "desc" }], skip, take,
                include: { scores: true, sheet: { select: { status: true, components: true } }, student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                           classSubject: { select: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true, code: true } } } },
                           term: { select: { id: true, name: true, session: { select: { id: true, name: true } } } } } }),
        ]);
        return { total, rows };
    }

    /** How many of these students have a total on the sheet. */
    completeCount(sheetId: string, studentIds: string[]): Promise<number> {
        return this.db.grade.count({ where: { sheetId, total: { not: null }, studentId: { in: studentIds } } });
    }
}

export type TenantTx = Prisma.TransactionClient;
