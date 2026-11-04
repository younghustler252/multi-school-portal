/*
| THE BRANCH RULE FOR PLACING STUDENTS (pure: no database, easy to test).
| A student belongs to one branch and can only be placed (enrolled, moved, promoted) in a class of THAT branch.
| The only way across is a student transfer (students module), which changes the student's branch first.
*/
export const sameBranch = (studentBranchId: string | null | undefined, classBranchId: string | null | undefined): boolean =>
    studentBranchId === classBranchId;

/** Rows that would put a student into a class of another branch (rows without a target class are fine). */
export function findBranchMismatches<R extends { studentId: string; toClassId: string | null }>(
    rows: R[], studentBranch: Map<string, string>, classBranch: Map<string, string>,
): R[] {
    return rows.filter(r => r.toClassId !== null && !sameBranch(studentBranch.get(r.studentId), classBranch.get(r.toClassId)));
}
