import { planTermAssignments } from "../../classes/services/class-subject-plan";

/*
| TERM ROLL-OVER: what happens when a new term becomes current.
|  - students: every ACTIVE student enrolled last term (in the same session) is enrolled in the same class
|  - teachers: last term's subject teachers are copied, then missing ones are filled by the default rules
| Set-based: a handful of queries for the whole school, inside the caller's transaction (so a failure also undoes
| the term switch). Safe to run again: anything already there is skipped, nothing is overwritten.
*/
export interface RolloverTx {
    enrolment:      { findMany(a: any): Promise<any[]>; createMany(a: any): Promise<{ count: number }> };
    class:          { findMany(a: any): Promise<any[]> };
    subject:        { findMany(a: any): Promise<any[]> };
    classSubject:   { findMany(a: any): Promise<any[]>; createMany(a: any): Promise<{ count: number }> };
    schoolSettings: { findFirst(a: any): Promise<any> };
}

export interface RolloverResult { enrolmentsCarried: number; assignmentsCarried: number; assignmentsSeeded: number }

/** Students who were active last term and are not yet enrolled this term. */
export function planEnrolmentCarryForward(previous: Array<{ studentId: string; classId: string }>, alreadyEnrolled: Set<string>) {
    return previous.filter(p => !alreadyEnrolled.has(p.studentId));
}

export async function rolloverInTx(tx: RolloverTx, fromTermId: string | null, toTermId: string): Promise<RolloverResult> {
    let enrolmentsCarried = 0;
    if (fromTermId) {
        const previous = await tx.enrolment.findMany({ where: { termId: fromTermId, status: "active", student: { isActive: true } }, select: { studentId: true, classId: true } });
        const now = await tx.enrolment.findMany({ where: { termId: toTermId }, select: { studentId: true } });
        const rows = planEnrolmentCarryForward(previous, new Set(now.map((e: any) => e.studentId)));
        if (rows.length) enrolmentsCarried = (await tx.enrolment.createMany({
            data: rows.map(r => ({ studentId: r.studentId, classId: r.classId, termId: toTermId, status: "active" })), skipDuplicates: true,
        })).count;
    }

    const classes  = await tx.class.findMany({ select: { id: true, classTeacherId: true } });
    const subjects = await tx.subject.findMany({ select: { id: true, defaultTeacherId: true } });
    const existing = await tx.classSubject.findMany({ where: { termId: toTermId }, select: { classId: true, subjectId: true } });
    const settings = await tx.schoolSettings.findFirst({ select: { teachingModel: true } });
    const previous = fromTermId ? await tx.classSubject.findMany({ where: { termId: fromTermId }, select: { classId: true, subjectId: true, staffId: true, assignedVia: true } }) : [];

    const { carried, seeded } = planTermAssignments({ classes, subjects, previous, existing, teachingModel: settings?.teachingModel ?? null });
    const rows = [...carried, ...seeded].map(a => ({ ...a, termId: toTermId }));
    if (rows.length) await tx.classSubject.createMany({ data: rows, skipDuplicates: true });

    return { enrolmentsCarried, assignmentsCarried: carried.length, assignmentsSeeded: seeded.length };
}
