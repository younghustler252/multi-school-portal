/* Real repositories and use cases for the graduation database tests (one throwaway school, real Postgres). */
import { getTenantClient } from "../../src/infrastructure/database/prisma/prisma.client";
import { StudentMapper } from "../../src/modules/students/mappers/student.mapper";
import { StudentRepositoryImpl } from "../../src/modules/students/repositories/student.repository.impl";
import { EnrolmentMapper } from "../../src/modules/enrolment/mappers/enrolment.mapper";
import { EnrolmentRepositoryImpl } from "../../src/modules/enrolment/repositories/enrolment.repository.impl";
import { ClassMapper, SubjectMapper, ClassSubjectMapper, ClassProgressionMapper } from "../../src/modules/classes/mappers/class.mapper";
import { ClassRepositoryImpl } from "../../src/modules/classes/repositories/class.repository.impl";
import { SessionMapper, TermMapper } from "../../src/modules/sessions/mappers/session.mapper";
import { SessionRepositoryImpl } from "../../src/modules/sessions/repositories/session.repository.impl";
import { EnrolmentPresenter } from "../../src/modules/enrolment/services/enrolment-presenter";

export const actor = { userId: "00000000-0000-4000-8000-000000000001" } as any;

export function buildDeps() {
    const studentMapper = new StudentMapper();
    const studentRepository = new StudentRepositoryImpl({ studentMapper } as any);
    const enrolmentRepository = new EnrolmentRepositoryImpl({ enrolmentMapper: new EnrolmentMapper() } as any);
    const classRepository = new ClassRepositoryImpl({ classMapper: new ClassMapper(), subjectMapper: new SubjectMapper(), classSubjectMapper: new ClassSubjectMapper(), classProgressionMapper: new ClassProgressionMapper() } as any);
    const sessionRepository = new SessionRepositoryImpl({ sessionMapper: new SessionMapper(), termMapper: new TermMapper() } as any);
    const studentPhotoService: any = { toResponse: async (s: any) => ({ ...s, photoUrl: null }), toResponses: async (l: any[]) => l.map(s => ({ ...s, photoUrl: null })) };
    const audits: any[] = [];
    const auditService: any = { log: async (p: any) => { audits.push(p); } };
    const enrolmentPresenter = new EnrolmentPresenter({ studentRepository, studentPhotoService, classRepository, sessionRepository } as any);
    return { studentRepository, enrolmentRepository, classRepository, sessionRepository, studentPhotoService, auditService, enrolmentPresenter, audits };
}

/** Session with two terms, three classes (JSS2 -> JSS3 -> graduates), and a mix of students. */
export async function seed() {
    const db = getTenantClient();
    const session = await db.session.create({ data: { name: "2026/2027", startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true } });
    const t1 = await db.term.create({ data: { sessionId: session.id, name: "first",  startDate: new Date("2026-09-01"), endDate: new Date("2026-12-15"), isCurrent: true } });
    const t2 = await db.term.create({ data: { sessionId: session.id, name: "second", startDate: new Date("2027-01-10"), endDate: new Date("2027-04-10"), isCurrent: false } });
    const jss2 = await db.class.create({ data: { name: "JSS 2", capacity: 5 } });
    const jss3 = await db.class.create({ data: { name: "JSS 3", capacity: 5 } });
    await db.classProgression.create({ data: { fromClassId: jss2.id, toClassId: jss3.id } });
    await db.classProgression.create({ data: { fromClassId: jss3.id, toClassId: null } });   // final class: graduates

    const mk = async (firstName: string, extra: Record<string, unknown> = {}) => db.student.create({ data: { firstName, lastName: "Test", ...extra } });
    const A = await mk("Ada");                       // graduating
    const B = await mk("Bola");                      // graduating
    const C = await mk("Chidi");                     // continuing: JSS2 -> JSS3
    const D = await mk("Dayo");                      // final class but ALREADY has a place in the new term: left alone
    const E = await mk("Efe", { isActive: false });  // withdrawn: not in the plan
    const enrol = (s: { id: string }, c: { id: string }, termId: string) => db.enrolment.create({ data: { studentId: s.id, classId: c.id, termId, status: "active" } });
    await enrol(A, jss3, t1.id); await enrol(B, jss3, t1.id); await enrol(C, jss2, t1.id); await enrol(D, jss3, t1.id); await enrol(E, jss3, t1.id);
    await enrol(D, jss3, t2.id);   // D is already placed in the next term

    // guardians: G1 only has a graduate; G2 has a graduate AND a continuing child; G3 has no children linked
    const g = (firstName: string, email: string) => db.guardian.create({ data: { firstName, lastName: "Parent", email } });
    const G1 = await g("Gina", "g1@x.com"), G2 = await g("Gus", "g2@x.com"), G3 = await g("Gail", "g3@x.com");
    const link = (gu: { id: string }, s: { id: string }) => db.studentGuardian.create({ data: { guardianId: gu.id, studentId: s.id, relation: "mother", isPrimary: false } });
    await link(G1, A); await link(G2, B); await link(G2, C);
    return { session, t1, t2, jss2, jss3, A, B, C, D, E, G1, G2, G3 };
}
