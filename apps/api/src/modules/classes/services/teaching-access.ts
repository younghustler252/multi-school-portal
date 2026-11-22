/*
|--------------------------------------------------------------------------
| WHO LEADS OR TEACHES A CLASS: THE ONE DEFINITION (owned by Classes)
|--------------------------------------------------------------------------
| Classes owns the academic assignments: Class.classTeacherId (who LEADS a class) and ClassSubject.staffId (who TEACHES a
| subject in a class, in a term). Staff only says who works at the school. Every module that limits what a teacher sees
| ("ASSIGNED" scope) asks Classes what that means, here, instead of keeping its own copy of the rule:
|
|   LEADS   a class        -> Class.classTeacherId, in ANY term
|   TEACHES a class        -> a ClassSubject row for them in the CURRENT term
|   TEACHES a subject      -> ClassSubject.staffId (the subject teacher of that class-subject)
|
| These are pure builders of Prisma filters and pure yes/no checks. They read nothing and write nothing.
| Each module decides WHICH of these its own rows need (e.g. report cards: the class teacher only), and says so in its
| scope file. To change what "leads" or "teaches" means (substitutes, co-class teachers), change it here, once.
|
| Differences between modules that are intended (kept, and tested in teaching-scope.characterisation.test.ts):
|   - attendance and enrolment rows: led in any term, taught in the current term only
|   - students: on the list of a class led or taught THIS term
|   - grades: subjects they teach, or any subject of a class they lead (viewing); entering is the subject teacher only
|   - report cards: the class teacher only
|--------------------------------------------------------------------------
*/

type Where = Record<string, unknown>;

/** Class rows the staff member LEADS (class teacher), whichever term. */
export const classLedBy = (staffId: string): Where => ({ classTeacherId: staffId });

/** Class rows the staff member TEACHES a subject in, in the CURRENT term. */
export const classTaughtThisTermBy = (staffId: string): Where => ({ classSubjects: { some: { staffId, term: { isCurrent: true } } } });

/** Class rows the staff member TEACHES a subject in, in the given term (the register of a past term). */
export const classTaughtInTermBy = (staffId: string, termId: string): Where => ({ classSubjects: { some: { staffId, termId } } });

/** Class rows the staff member leads, or teaches in this term. */
export const classLedOrTaughtBy = (staffId: string): Where => ({ OR: [classLedBy(staffId), classTaughtThisTermBy(staffId)] });

/** Rows that carry a class and a term (class lists, registers): classes led in any term; classes taught, this term's rows only. */
export const rowsOfClassesLedOrTaughtBy = (staffId: string): Where => ({
    OR: [{ class: classLedBy(staffId) }, { term: { isCurrent: true }, class: classTaughtThisTermBy(staffId) }],
});

/** Students on the list, this term, of a class the staff member leads or teaches. */
export const studentsOfClassesLedOrTaughtBy = (staffId: string): Where => ({
    enrolments: { some: { term: { isCurrent: true }, class: classLedOrTaughtBy(staffId) } },
});

/** ClassSubject rows (mark sheets) the staff member teaches, or whose class they lead. */
export const classSubjectsTaughtOrLedBy = (staffId: string): Where => ({ OR: [{ staffId }, { class: classLedBy(staffId) }] });

/** For a class already loaded: does this person lead it? (false for no one: an unassigned class has no leader) */
export const leadsClass = (staffId: string | null | undefined, classTeacherId: string | null | undefined): boolean => !!staffId && classTeacherId === staffId;

/** For a class-subject already loaded: is this person its subject teacher? */
export const teachesSubject = (staffId: string | null | undefined, subjectTeacherId: string | null | undefined): boolean => !!staffId && subjectTeacherId === staffId;
