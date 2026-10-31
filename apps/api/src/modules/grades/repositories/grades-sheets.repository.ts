import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
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
}
