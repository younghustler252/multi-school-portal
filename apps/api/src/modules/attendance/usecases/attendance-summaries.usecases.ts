import type { Access } from "../../../foundation/access.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AttendanceRepository } from "../repositories/attendance.repository";
import { NameRef, StudentRef, TermRef, studentRef, termRef } from "../services/attendance-presenter";
import { attendanceViewWhere, classInScope } from "../services/attendance-scope";
import { attendanceErrors } from "../domain/attendance.errors";
import { AttendanceSummary, Counts, summarize } from "../domain/attendance.policy";
import { ClassSummaryQueryType, StudentSummaryQueryType } from "../dtos/attendance.dto";

interface Dependencies { attendanceRepository: AttendanceRepository }

/* Excused days are shown on their own and are not in the rate. `unmarked` = days a register was taken for the class that
|  the student was left without a mark. Counts come from ONE grouped query. */
export interface SummaryWithRegisters extends AttendanceSummary { registerDays: number; unmarked: number }
const withRegisters = (s: AttendanceSummary, registerDays: number): SummaryWithRegisters =>
    ({ ...s, registerDays, unmarked: Math.max(0, registerDays - s.daysMarked) });

async function termOf(repo: AttendanceRepository, termId?: string): Promise<TermRef> {
    const terms = await repo.allTerms();
    const t = termId ? terms.find(x => x.id === termId) : terms.find(x => x.isCurrent);
    if (!t) throw attendanceErrors.outsideTerm();
    return termRef(t);
}

export class StudentSummaryUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: StudentSummaryQueryType, access: Access): Promise<{ student: StudentRef; term: TermRef; class: NameRef | null } & SummaryWithRegisters> {
        const repo = this.d.attendanceRepository;
        const db = getTenantClient();
        const student = await db.student.findUnique({ where: { id: query.studentId }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } });
        if (!student) throw attendanceErrors.studentNotFound();
        const term = await termOf(repo, query.termId);

        // what this person may see of this student (a teacher sees only their classes; a guardian only their child)
        const where = { AND: [attendanceViewWhere(access), { studentId: student.id, termId: term.id }] };
        const grouped = await db.attendance.groupBy({ by: ["status"], where, _count: { _all: true } });
        const counts: Counts = {};
        for (const g of grouped) counts[g.status as keyof Counts] = g._count._all;

        const enrolment = await repo.studentClassIn(student.id, term.id);
        const registerDays = enrolment ? await repo.registerDays(enrolment.classId, term.id) : 0;
        return { student: studentRef(student), term, class: enrolment ? { id: enrolment.class.id, name: enrolment.class.name } : null, ...withRegisters(summarize(counts), registerDays) };
    }
}

export class ClassSummaryUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(classId: string, query: ClassSummaryQueryType, access: Access) {
        const repo = this.d.attendanceRepository;
        const term = await termOf(repo, query.termId);
        const cls = await repo.findClass(classId);
        if (!cls) throw attendanceErrors.classNotFound();
        if (!(await classInScope(access, "attendance.view", classId, term.id))) throw attendanceErrors.classNotVisible();

        const [enrolled, grouped, registerDays] = await Promise.all([
            repo.studentsOnRegister(classId, term.id),
            getTenantClient().attendance.groupBy({ by: ["studentId", "status"], where: { classId, termId: term.id }, _count: { _all: true } }),
            repo.registerDays(classId, term.id),
        ]);
        const perStudent = new Map<string, Counts>();
        for (const g of grouped) {
            const c = perStudent.get(g.studentId) ?? {};
            c[g.status as keyof Counts] = g._count._all;
            perStudent.set(g.studentId, c);
        }
        const total: Counts = {};
        const students = enrolled.map(e => {
            const c = perStudent.get(e.studentId) ?? {};
            for (const k of Object.keys(c) as Array<keyof Counts>) total[k] = (total[k] ?? 0) + (c[k] ?? 0);
            return { student: studentRef(e.student), ...withRegisters(summarize(c), registerDays) };
        });
        return { class: { id: cls.id, name: cls.name }, term, registerDays, classSummary: summarize(total), students };
    }
}
