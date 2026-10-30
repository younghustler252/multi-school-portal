/* Real repositories and a seeded school for the attendance database tests. Dates are relative to "today" at the school. */
import { getTenantClient } from "../../src/infrastructure/database/prisma/prisma.client";
import { Access } from "../../src/foundation/access.service";
import { AttendanceRepository } from "../../src/modules/attendance/repositories/attendance.repository";
import { AttendancePresenter } from "../../src/modules/attendance/services/attendance-presenter";
import { addDays, dayKey, parseSchoolDay, todayKey } from "../../src/modules/attendance/domain/attendance.policy";

export const day = (offset: number): string => dayKey(addDays(parseSchoolDay(todayKey())!, offset));

export function buildDeps() {
    const attendanceRepository = new AttendanceRepository();
    const userRepository: any = { findByIds: async (ids: string[]) => ids.map(id => ({ id, firstName: "User", lastName: id.slice(-4) })) };
    const attendancePresenter = new AttendancePresenter({ attendanceRepository, userRepository });
    const audits: any[] = [];
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    return { attendanceRepository, attendancePresenter, auditService, audits };
}

type Perms = Record<string, "ALL" | "ASSIGNED" | "OWN">;
export const access = (persona: "STAFF" | "STUDENT" | "GUARDIAN", entityId: string | null, perms: Perms, userId = "user-" + (entityId ?? "x").slice(0, 6)) =>
    new Access("school", userId, "m1", persona, entityId, new Set(), false, new Map(Object.entries(perms)));

export const ADMIN = { "attendance.view": "ALL", "attendance.mark": "ALL", "attendance.override": "ALL" } as Perms;
export const adminAccess = () => access("STAFF", "admin-staff", ADMIN, "user-admin");

export async function seed() {
    const db = getTenantClient();
    const session = await db.session.create({ data: { name: "2026/2027", startDate: new Date(`${day(-30)}T00:00:00Z`), endDate: new Date(`${day(300)}T00:00:00Z`), isCurrent: true } });
    const term = await db.term.create({ data: { sessionId: session.id, name: "first", startDate: new Date(`${day(-20)}T00:00:00Z`), endDate: new Date(`${day(20)}T00:00:00Z`), isCurrent: true } });
    const oldTerm = await db.term.create({ data: { sessionId: session.id, name: "second", startDate: new Date(`${day(-200)}T00:00:00Z`), endDate: new Date(`${day(-150)}T00:00:00Z`), isCurrent: false } });

    const staff = (firstName: string) => db.staff.create({ data: { firstName, lastName: "Teacher" } });
    const tA = await staff("Tola"), tB = await staff("Bisi"), tC = await staff("Chuka");

    const C1 = await db.class.create({ data: { name: "JSS 1A", classTeacherId: tA.id } });
    const C2 = await db.class.create({ data: { name: "JSS 2A" } });
    const subject = await db.subject.create({ data: { name: "Maths" } });
    const subject2 = await db.subject.create({ data: { name: "English" } });
    await db.classSubject.create({ data: { classId: C2.id, subjectId: subject.id, staffId: tB.id, termId: term.id } });      // Bisi teaches JSS 2A this term
    await db.classSubject.create({ data: { classId: C1.id, subjectId: subject2.id, staffId: tC.id, termId: oldTerm.id } });   // Chuka taught JSS 1A LAST term only

    const stu = (firstName: string, extra: Record<string, unknown> = {}) => db.student.create({ data: { firstName, lastName: "Pupil", ...extra } });
    const s1 = await stu("Ada"), s2 = await stu("Bola"), s3 = await stu("Chidi"), s4 = await stu("Dayo"), s5 = await stu("Efe"), s6 = await stu("Femi");
    const enrol = (s: { id: string }, c: { id: string }, status: any = "active") => db.enrolment.create({ data: { studentId: s.id, classId: c.id, termId: term.id, status } });
    await enrol(s1, C1); await enrol(s2, C1); await enrol(s3, C1); await enrol(s4, C2); await enrol(s5, C1, "withdrawn");   // s6 is on no class list

    await db.calendarEvent.create({ data: { title: "Mid-term break", startDate: new Date(`${day(-3)}T00:00:00Z`), endDate: new Date(`${day(-3)}T00:00:00Z`), type: "holiday", isHoliday: true } });
    await db.calendarEvent.create({ data: { title: "Sports day", startDate: new Date(`${day(-4)}T00:00:00Z`), type: "event", isHoliday: false } });

    const guardian = await db.guardian.create({ data: { firstName: "Gina", lastName: "Parent", email: "gina@x.com" } });
    await db.studentGuardian.create({ data: { guardianId: guardian.id, studentId: s1.id, relation: "mother", isPrimary: false } });
    return { session, term, oldTerm, tA, tB, tC, C1, C2, s1, s2, s3, s4, s5, s6, guardian };
}
