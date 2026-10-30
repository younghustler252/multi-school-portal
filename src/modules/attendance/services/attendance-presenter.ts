import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { dayKey } from "../domain/attendance.policy";
import { AttendanceRepository } from "../repositories/attendance.repository";

/* Responses carry names, not bare ids. One lookup per page, never per row. A missing relation is null. */
export interface NameRef { id: string; name: string }
export interface StudentRef { id: string; name: string; admissionNumber: string | null }
export interface TermRef extends NameRef { session: NameRef | null }

export interface AttendanceResponse {
    id: string; date: string; status: string; note: string | null;
    student: StudentRef | null; class: NameRef | null; term: TermRef | null;
    markedBy: NameRef | null; markedAt: Date; updatedAt: Date;
}

export const studentRef = (s: { id: string; firstName: string; lastName: string; admissionNumber: string | null }): StudentRef =>
    ({ id: s.id, name: [s.firstName, s.lastName].filter(Boolean).join(" "), admissionNumber: s.admissionNumber ?? null });

export const termRef = (t: { id: string; name: string; session: { id: string; name: string } | null }): TermRef =>
    ({ id: t.id, name: t.name, session: t.session ? { id: t.session.id, name: t.session.name } : null });

interface Deps { attendanceRepository: AttendanceRepository; userRepository: IUserRepository }

export class AttendancePresenter {
    constructor(private readonly d: Deps) {}

    /** Names of the people (login ids) who marked: ONE lookup. */
    async markers(userIds: Array<string | null | undefined>): Promise<Map<string, NameRef>> {
        const ids = [...new Set(userIds.filter((x): x is string => !!x))];
        if (ids.length === 0) return new Map();
        const users = await this.d.userRepository.findByIds(ids);
        return new Map(users.map(u => [u.id, { id: u.id, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Unnamed" }]));
    }

    async many(rows: Array<{ id: string; studentId: string; classId: string | null; termId: string; date: Date; status: string; note: string | null; markedById: string | null; createdAt: Date; updatedAt: Date }>): Promise<AttendanceResponse[]> {
        if (rows.length === 0) return [];
        const db = getTenantClient();
        const studentIds = [...new Set(rows.map(r => r.studentId))];
        const classIds = [...new Set(rows.map(r => r.classId).filter((x): x is string => !!x))];
        const [students, classes, terms, markers] = await Promise.all([
            db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } }),
            classIds.length ? db.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
            this.d.attendanceRepository.allTerms(),
            this.markers(rows.map(r => r.markedById)),
        ]);
        const studentBy = new Map(students.map(s => [s.id, studentRef(s)]));
        const classBy = new Map(classes.map(c => [c.id, { id: c.id, name: c.name }]));
        const termBy = new Map(terms.map(t => [t.id, termRef(t)]));
        return rows.map(r => ({
            id: r.id, date: dayKey(r.date), status: r.status, note: r.note,
            student: studentBy.get(r.studentId) ?? null,
            class: r.classId ? classBy.get(r.classId) ?? null : null,
            term: termBy.get(r.termId) ?? null,
            markedBy: r.markedById ? markers.get(r.markedById) ?? null : null,
            markedAt: r.createdAt, updatedAt: r.updatedAt,
        }));
    }
}
