import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { ENROLMENT_STATUSES } from "../../grades/repositories/enrolment-statuses";
import { CardTable, cardTable, CARD_INCLUDE } from "./card-table";

/*
| REPORT CARD DATA ACCESS (the tenant client follows the request's school).
| The ReportCard columns added by migration 20261105090000 (classId, snapshot, generatedById, publishedAt, publishedById, unpublishReason)
| are typed here by hand, so this file compiles with the Prisma client you have today. After `npm run prisma:generate` the
| generated types carry the same columns and `CardTable` can be replaced by `Prisma.ReportCardDelegate`.
*/
export class ReportCardsRepository {
    private get db() { return getTenantClient(); }
    get cards(): CardTable { return cardTable(this.db); }

    /** Run several card writes together: all happen or none. */
    inTransaction<T>(fn: (cards: CardTable) => Promise<T>): Promise<T> { return this.db.$transaction(async tx => fn(cardTable(tx))); }

    currentTerm() { return this.db.term.findFirst({ where: { isCurrent: true }, select: { id: true } }); }
    term(id: string) { return this.db.term.findUnique({ where: { id }, select: { id: true, name: true, session: { select: { id: true, name: true } } } }); }
    classOf(id: string) { return this.db.class.findUnique({ where: { id }, select: { id: true, name: true, level: true, classTeacherId: true } }); }

    /** Students on the class list for the term (withdrawn and transferred students are not on it), by name. */
    studentsOnList(classId: string, termId: string) {
        return this.db.enrolment.findMany({
            where: { classId, termId, status: { in: [...ENROLMENT_STATUSES] } },
            select: { studentId: true, student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, gender: true } } },
            orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        });
    }

    /** Every subject the class has this term, with its mark sheet (if one exists yet). */
    subjectsWithSheets(classId: string, termId: string) {
        return this.db.classSubject.findMany({
            where: { classId, termId },
            select: {
                id: true, subject: { select: { name: true } }, staff: { select: { firstName: true, lastName: true } },
                sheet: { select: { id: true, status: true, components: true, scale: true, publishedAt: true } },
            },
        });
    }

    gradesForSheets(sheetIds: string[]) {
        if (sheetIds.length === 0) return Promise.resolve([]);
        return this.db.grade.findMany({
            where: { sheetId: { in: sheetIds } },
            select: { sheetId: true, studentId: true, total: true, grade: true, remark: true, position: true, totalStudents: true, scores: { select: { position: true, score: true, isAbsent: true } } },
        });
    }

    /** Days marked per status for each student this term. */
    async attendanceByStudent(termId: string, studentIds: string[]) {
        if (studentIds.length === 0) return new Map<string, Array<{ status: string }>>();
        const rows = await this.db.attendance.groupBy({ by: ["studentId", "status"], where: { termId, studentId: { in: studentIds } }, _count: { _all: true } });
        const out = new Map<string, Array<{ status: string }>>();
        for (const r of rows) { const list = out.get(r.studentId) ?? []; for (let i = 0; i < r._count._all; i++) list.push({ status: r.status }); out.set(r.studentId, list); }
        return out;
    }

    /** Active guardians of the students, by student. */
    async guardiansOf(studentIds: string[]) {
        const out = new Map<string, Array<{ id: string; firstName: string; email: string | null; phone: string | null; userId: string | null }>>();
        if (studentIds.length === 0) return out;
        const links = await this.db.studentGuardian.findMany({
            where: { studentId: { in: studentIds }, guardian: { isActive: true } },
            select: { studentId: true, guardian: { select: { id: true, firstName: true, email: true, phone: true, userId: true } } },
        });
        for (const l of links) { const list = out.get(l.studentId) ?? []; list.push({ id: l.guardian.id, firstName: l.guardian.firstName, email: l.guardian.email || null, phone: l.guardian.phone, userId: l.guardian.userId }); out.set(l.studentId, list); }
        return out;
    }

    cardsOfStudents(termId: string, studentIds: string[]) {
        return this.cards.findMany({ where: { termId, studentId: { in: studentIds } }, include: CARD_INCLUDE });
    }
}

