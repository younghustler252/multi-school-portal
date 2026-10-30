/*
|--------------------------------------------------------------------------
| STUDENT ELIGIBILITY: the ONE rule for "does this student count?"
|
|   isActive     = still on the school's books (can be enrolled, invoiced, paid for by guardians)
|   graduatedAt  = finished the last class (set by the end-of-year promotion run, cleared only by the audited
|                  "undo graduation")
|
| A student COUNTS toward the plan's student limit (students.max) when operationally active AND not graduated.
| A graduate stays isActive on purpose: their history, report cards, fee invoices and their guardians' access to
| pay any balance must keep working. Every plan-limit meter and "active students" figure uses the constant below;
| a test fails if code counts students any other way.
|--------------------------------------------------------------------------
*/

export const ACTIVE_STUDENT_WHERE = { isActive: true, graduatedAt: null } as const;

/** Where a general (school-wide) message may go: on the books, and not a graduate unless the sender asks for graduates too. */
export const receivesAnnouncement = (s: { isActive: boolean; graduatedAt?: Date | null }, opts: { includeGraduates?: boolean } = {}): boolean =>
    s.isActive && (!!opts.includeGraduates || !s.graduatedAt);

/**
 * Fee reminders follow the MONEY, not the student's status: while an eligible unpaid balance remains, the family is
 * reminded, whether the student is active, graduated or has left. (Graduating never switches reminders off.)
 */
export const receivesFeeReminder = (outstandingKobo: number): boolean => outstandingKobo > 0;

/**
 * A guardian is left out of a general announcement only when ALL their linked students are graduates. A guardian
 * with at least one continuing child, or with no linked child at all, still receives it.
 */
export const guardianAnnouncementWhere = (includeGraduates: boolean) => includeGraduates
    ? { isActive: true }
    : { isActive: true, NOT: { AND: [{ studentLinks: { some: {} } }, { studentLinks: { every: { student: { graduatedAt: { not: null } } } } }] } };

export type StudentLifecycle = "active" | "graduated" | "inactive";

export const isGraduated = (s: { graduatedAt?: Date | null }): boolean => !!s.graduatedAt;

/** Counts toward students.max */
export const countsTowardPlan = (s: { isActive: boolean; graduatedAt?: Date | null }): boolean => s.isActive && !s.graduatedAt;

/** graduated wins over inactive: graduation is a separate fact from being on the books. */
export const studentLifecycle = (s: { isActive: boolean; graduatedAt?: Date | null }): StudentLifecycle =>
    s.graduatedAt ? "graduated" : s.isActive ? "active" : "inactive";
