import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { addDays, dayKey, ENROLMENT_STATUSES_ON_REGISTER } from "../domain/attendance.policy";

/* All attendance database reads in one place (the tenant client follows the request's school). */
export interface TermRow { id: string; name: string; startDate: Date; endDate: Date; isCurrent: boolean; session: { id: string; name: string } | null }

export class AttendanceRepository {
    private get db() { return getTenantClient(); }

    async allTerms(): Promise<TermRow[]> {
        return this.db.term.findMany({ select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true, session: { select: { id: true, name: true } } } }) as Promise<TermRow[]>;
    }
    async currentTerm(): Promise<TermRow | null> {
        return (await this.db.term.findFirst({ where: { isCurrent: true }, select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true, session: { select: { id: true, name: true } } } })) as TermRow | null;
    }
    findClass(id: string) { return this.db.class.findUnique({ where: { id }, select: { id: true, name: true, classTeacherId: true } }); }

    /** Holiday events that could cover this day (the exact check is done on the date text, see holidayOn). */
    holidayCandidates(day: Date) {
        return this.db.calendarEvent.findMany({
            where: { isHoliday: true, startDate: { lt: addDays(day, 1) }, OR: [{ endDate: { gte: day } }, { endDate: null }] },
            select: { title: true, isHoliday: true, startDate: true, endDate: true },
        });
    }

    /** Students on a class's register in a term (withdrawn and transferred students are not on it), by name. */
    studentsOnRegister(classId: string, termId: string) {
        return this.db.enrolment.findMany({
            where: { classId, termId, status: { in: [...ENROLMENT_STATUSES_ON_REGISTER] } },
            select: { studentId: true, student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
            orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        });
    }

    /** The marks of these students on one school day. Rows saved with a clock time on that day are found too. */
    rowsForDay(studentIds: string[], day: Date) {
        return this.db.attendance.findMany({ where: { studentId: { in: studentIds }, date: { gte: day, lt: addDays(day, 1) } } });
    }

    findById(id: string) { return this.db.attendance.findUnique({ where: { id } }); }

    /** How many different days had a register for this class in the term. */
    async registerDays(classId: string, termId: string): Promise<number> {
        const days = await this.db.attendance.groupBy({ by: ["date"], where: { classId, termId } });
        return new Set(days.map(d => dayKey(d.date))).size;
    }

    studentClassIn(studentId: string, termId: string) {
        return this.db.enrolment.findFirst({ where: { studentId, termId, status: { in: [...ENROLMENT_STATUSES_ON_REGISTER] } }, select: { classId: true, class: { select: { id: true, name: true } } } });
    }
}
