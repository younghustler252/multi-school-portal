/*
|--------------------------------------------------------------------------
| OUTSTANDING TEACHER HANDOVER (read-only), owned by Classes
|--------------------------------------------------------------------------
| When a teacher is deactivated their class and subject assignments are KEPT (nothing is cleared or moved). This answers:
| "which assignments still point at someone who has left, and need a new person?" The answer is DERIVED from the current
| data. Nothing is stored, so it clears by itself when an assignment is reassigned or the person is reactivated.
|
| What counts as outstanding (agreed product rules):
|   - a class they LEAD (Class.classTeacherId): always, whatever their mark sheets look like
|   - a subject assignment in the CURRENT or an UPCOMING term whose mark sheet is not finished
|       (no sheet yet, draft, submitted or approved)
|   - a subject whose DEFAULT teacher they are (it would otherwise keep proposing them)
| "Upcoming" = a term that is not flagged current and STARTS TODAY OR LATER, by the school's own calendar date. A term that
| starts today but has not been made current yet is therefore upcoming, not history. (Term dates are compared by their date part.)
| What does not:
|   - a subject assignment whose mark sheet is PUBLISHED or LOCKED: the work is finished. It is listed under "completed"
|     (so ownership is not hidden) but is not outstanding.
|   - assignments in PAST terms: history, never touched. Only counted.
|
| Branch-scoped viewers: pass `branchIds` to see only classes of those branches (class led and subject assignments follow
| the class's branch). Subject defaults belong to no branch, so they are shown only when `branchIds` is null (all branches).
|
| This module only READS. Run it inside a read-only transaction.
|--------------------------------------------------------------------------
*/

export interface SqlClient { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> }

export type SheetStatus = "draft" | "submitted" | "approved" | "published" | "locked";
/** A finished mark sheet: nothing is left to do on it. */
export const isFinishedSheet = (status: string | null | undefined): boolean => status === "published" || status === "locked";

export interface DepartedStaff { id: string; name: string; category: string; exitDate: string | null; exitReason: string | null }
export interface ClassLed { classId: string; className: string; branchId: string }
export interface SubjectAssignment {
    classSubjectId: string; classId: string; className: string; branchId: string; subjectName: string;
    termId: string; termName: string; isCurrentTerm: boolean; sheetStatus: SheetStatus | null;
}
export interface SubjectDefault { subjectId: string; subjectName: string }

export interface DepartedTeacherHandover {
    staff: DepartedStaff;
    classesLed: ClassLed[];
    outstandingSubjects: SubjectAssignment[];
    completedSubjects: SubjectAssignment[];     // finished sheets: ownership shown, no action needed
    defaultsToUpdate: SubjectDefault[];
    pastTermAssignments: number;                // history: left exactly as it is
}

export interface HandoverTotals {
    teachersNeedingAttention: number; classesLed: number; outstandingSubjects: number; defaultsToUpdate: number;
    completedSubjects: number;                  // finished sheets on teachers who do need attention
    teachersWithOnlyFinishedWork: number;       // left, but nothing outstanding: no action needed
}
export interface HandoverReport { generatedAt: string; teachers: DepartedTeacherHandover[]; totals: HandoverTotals }

export interface HandoverRows {
    staff: { id: string; firstName: string; lastName: string; category: string; exitDate: Date | null; exitReason: string | null }[];
    classesLed: { staffId: string; classId: string; className: string; branchId: string }[];
    subjects: { staffId: string; classSubjectId: string; classId: string; className: string; branchId: string; subjectName: string; termId: string; termName: string; isCurrent: boolean; startsInFuture: boolean; sheetStatus: string | null }[];
    defaults: { staffId: string; subjectId: string; subjectName: string }[];
}

/** Pure: turns the rows into the report. */
export function assembleHandover(rows: HandoverRows, generatedAt: Date): HandoverReport {
    const teachers: DepartedTeacherHandover[] = [];
    let withOnlyFinished = 0;

    for (const s of rows.staff) {
        const mine = rows.subjects.filter(x => x.staffId === s.id);
        const live = mine.filter(x => x.isCurrent || x.startsInFuture);        // current or future term; the rest is history
        const toSubject = (x: HandoverRows["subjects"][number]): SubjectAssignment => ({
            classSubjectId: x.classSubjectId, classId: x.classId, className: x.className, branchId: x.branchId, subjectName: x.subjectName,
            termId: x.termId, termName: x.termName, isCurrentTerm: x.isCurrent, sheetStatus: (x.sheetStatus as SheetStatus | null),
        });
        const outstanding = live.filter(x => !isFinishedSheet(x.sheetStatus)).map(toSubject);
        const completed   = live.filter(x => isFinishedSheet(x.sheetStatus)).map(toSubject);
        const classesLed  = rows.classesLed.filter(x => x.staffId === s.id).map(x => ({ classId: x.classId, className: x.className, branchId: x.branchId }));
        const defaults    = rows.defaults.filter(x => x.staffId === s.id).map(x => ({ subjectId: x.subjectId, subjectName: x.subjectName }));
        const entry: DepartedTeacherHandover = {
            staff: { id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), category: s.category, exitDate: s.exitDate ? s.exitDate.toISOString().slice(0, 10) : null, exitReason: s.exitReason },
            classesLed, outstandingSubjects: outstanding, completedSubjects: completed, defaultsToUpdate: defaults,
            pastTermAssignments: mine.length - live.length,
        };
        if (classesLed.length || outstanding.length || defaults.length) teachers.push(entry);
        else if (completed.length) withOnlyFinished++;
    }

    teachers.sort((a, b) => a.staff.name.localeCompare(b.staff.name));
    return {
        generatedAt: generatedAt.toISOString(), teachers,
        totals: {
            teachersNeedingAttention: teachers.length,
            classesLed: teachers.reduce((n, t) => n + t.classesLed.length, 0),
            outstandingSubjects: teachers.reduce((n, t) => n + t.outstandingSubjects.length, 0),
            defaultsToUpdate: teachers.reduce((n, t) => n + t.defaultsToUpdate.length, 0),
            completedSubjects: teachers.reduce((n, t) => n + t.completedSubjects.length, 0),
            teachersWithOnlyFinishedWork: withOnlyFinished,
        },
    };
}

/** Reads one school's schema (the client's search_path must already point at it). Read-only. */
/** `today` = the school's own calendar date (YYYY-MM-DD); left out, the UTC date of `now` is used. */
export async function loadOutstandingHandover(client: SqlClient, opts: { branchIds?: string[] | null; now?: Date; today?: string } = {}): Promise<HandoverReport> {
    const now = opts.now ?? new Date();
    const today = opts.today ?? now.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`today must be YYYY-MM-DD, got "${today}"`);
    const branchIds = opts.branchIds ?? null;
    const branchSql = (alias: string, n: number) => (branchIds ? ` AND ${alias}."branchId" = ANY($${n}::text[])` : "");
    const branchArgs = branchIds ? [branchIds] : [];

    const staff = (await client.query(
        `SELECT s.id, s."firstName", s."lastName", s.category::text AS category, s."exitDate", s."exitReason" FROM "Staff" s WHERE s."isActive" = false`)).rows;
    if (staff.length === 0) return assembleHandover({ staff: [], classesLed: [], subjects: [], defaults: [] }, now);

    const classesLed = (await client.query(
        `SELECT c."classTeacherId" AS "staffId", c.id AS "classId", c.name AS "className", c."branchId"
           FROM "Class" c JOIN "Staff" s ON s.id = c."classTeacherId" AND s."isActive" = false
          WHERE true${branchSql("c", 1)}`, branchArgs)).rows;

    const subjects = (await client.query(
        `SELECT cs."staffId", cs.id AS "classSubjectId", c.id AS "classId", c.name AS "className", c."branchId",
                sub.name AS "subjectName", t.id AS "termId", t.name::text AS "termName", t."isCurrent",
                (NOT t."isCurrent" AND t."startDate"::date >= $1::date) AS "startsInFuture", rs.status::text AS "sheetStatus"
           FROM "ClassSubject" cs
           JOIN "Staff" s   ON s.id = cs."staffId" AND s."isActive" = false
           JOIN "Class" c   ON c.id = cs."classId"
           JOIN "Subject" sub ON sub.id = cs."subjectId"
           JOIN "Term" t    ON t.id = cs."termId"
           LEFT JOIN "ResultSheet" rs ON rs."classSubjectId" = cs.id
          WHERE true${branchSql("c", 2)}`, [today, ...branchArgs])).rows;

    const defaults = branchIds ? [] : (await client.query(
        `SELECT sub."defaultTeacherId" AS "staffId", sub.id AS "subjectId", sub.name AS "subjectName"
           FROM "Subject" sub JOIN "Staff" s ON s.id = sub."defaultTeacherId" AND s."isActive" = false`)).rows;

    return assembleHandover({ staff, classesLed, subjects, defaults }, now);
}
