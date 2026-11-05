import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { lockClass } from "../../enrolment/services/class-seats";
import { addDays, dayKey, ENROLMENT_STATUSES_ON_REGISTER } from "../domain/attendance.policy";

/* All attendance database reads in one place (the tenant client follows the request's school). */
export interface TermRow { id: string; name: string; startDate: Date; endDate: Date; isCurrent: boolean; session: { id: string; name: string } | null }

export interface StudentNameRow { id: string; firstName: string; lastName: string; admissionNumber: string | null }
export type AttendanceRow = NonNullable<Awaited<ReturnType<AttendanceRepository["findById"]>>>;
export type AttendanceStatusValue = AttendanceRow["status"];

/** What the register submission may do inside its one transaction (the class row is already locked). */
export interface RegisterTx {
    rowsForDay(studentIds: string[], day: Date): Promise<AttendanceRow[]>;
    update(id: string, data: { status: AttendanceStatusValue; note: string | null; classId: string; termId: string; markedById: string; date?: Date }): Promise<void>;
    createMany(rows: Array<{ studentId: string; termId: string; classId: string; date: Date; status: AttendanceStatusValue; note: string | null; markedById: string }>): Promise<void>;
}

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

    /* ── reads used by the use cases (so none of them touch the database client) ── */

    findStudent(id: string): Promise<StudentNameRow | null> {
        return this.db.student.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } });
    }
    findStudents(ids: string[]): Promise<StudentNameRow[]> {
        return ids.length ? this.db.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } }) : Promise.resolve([]);
    }
    findClassNames(ids: string[]): Promise<Array<{ id: string; name: string }>> {
        return ids.length ? this.db.class.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : Promise.resolve([]);
    }

    /** Status counts for the rows matching `where` (the caller builds the visibility filter). */
    async statusCounts(where: Record<string, unknown>): Promise<Array<{ status: string; count: number }>> {
        const g = await this.db.attendance.groupBy({ by: ["status"], where: where as any, _count: { _all: true } });
        return g.map(x => ({ status: x.status, count: x._count._all }));
    }
    /** Status counts per student for one class in one term. */
    async statusCountsByStudent(classId: string, termId: string): Promise<Array<{ studentId: string; status: string; count: number }>> {
        const g = await this.db.attendance.groupBy({ by: ["studentId", "status"], where: { classId, termId }, _count: { _all: true } });
        return g.map(x => ({ studentId: x.studentId, status: x.status, count: x._count._all }));
    }

    /** One page of marks, newest first, with the total for the same filter. */
    async page(where: Record<string, unknown>, skip: number, take: number): Promise<{ total: number; rows: AttendanceRow[] }> {
        const [total, rows] = await Promise.all([
            this.db.attendance.count({ where: where as any }),
            this.db.attendance.findMany({ where: where as any, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip, take }),
        ]);
        return { total, rows };
    }

    /** Does this staff member lead the class, or teach it in the term? (used by the ASSIGNED scope) */
    async staffCoversClass(staffId: string, classId: string, termId: string): Promise<boolean> {
        const [leads, teaches] = await Promise.all([
            this.db.class.count({ where: { id: classId, classTeacherId: staffId } }),
            this.db.classSubject.count({ where: { classId, termId, staffId } }),
        ]);
        return leads > 0 || teaches > 0;
    }

    async updateMark(id: string, data: { status?: AttendanceStatusValue; note?: string | null }, markedById: string): Promise<AttendanceRow> {
        return this.db.attendance.update({ where: { id }, data: { ...data, markedById } });
    }

    /** Runs `work` in one transaction with the class row locked, so two people submitting one register queue up. */
    async inRegisterTransaction<T>(classId: string, work: (tx: RegisterTx) => Promise<T>): Promise<T> {
        return this.db.$transaction(async raw => {
            await lockClass(raw as any, classId);
            const tx: RegisterTx = {
                rowsForDay: (studentIds, day) => raw.attendance.findMany({ where: { studentId: { in: studentIds }, date: { gte: day, lt: addDays(day, 1) } }, orderBy: { createdAt: "asc" } }),
                update: async (id, data) => { await raw.attendance.update({ where: { id }, data }); },
                createMany: async rows => { await raw.attendance.createMany({ data: rows }); },
            };
            return work(tx);
        }, { maxWait: 5000, timeout: 30000 });
    }
}
