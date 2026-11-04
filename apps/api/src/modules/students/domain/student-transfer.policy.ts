import { studentErrors } from "./student.errors";

/*
| STUDENT TRANSFER BETWEEN BRANCHES (pure: no database, easy to test).
| The ONLY way a student changes branch. Promotion, enrolment, edit and import never do.
|   - the student must not be a graduate, and the new branch must be a different, usable one
|   - a student with an ACTIVE enrolment in the current term must be given the class they go to: a class of the NEW
|     branch (their place moves with them; room is checked). A student with no active enrolment just changes branch,
|     and no class may be sent (they are placed later, by a normal enrolment, in a class of their new branch)
|   - past terms are never touched: old enrolments, attendance, grades and report cards keep pointing at the old class
*/
export interface TransferInput {
    student: { branchId: string; graduatedAt: Date | null };
    toBranchId: string;
    classId: string | undefined;
    /** the student's ACTIVE enrolment in the current term, if any */
    enrolment: { id: string; classId: string } | null;
    /** the class named in the request (loaded by the caller), if any */
    targetClass: { id: string; branchId: string } | null;
}
export interface TransferPlan { moveEnrolment: { enrolmentId: string; fromClassId: string; toClassId: string } | null }

export function planTransfer(i: TransferInput): TransferPlan {
    if (i.student.graduatedAt) throw studentErrors.transferGraduated();
    if (i.student.branchId === i.toBranchId) throw studentErrors.alreadyInBranch();
    if (!i.enrolment) {
        if (i.classId) throw studentErrors.transferClassNotNeeded();
        return { moveEnrolment: null };
    }
    if (!i.classId) throw studentErrors.transferClassRequired();
    if (!i.targetClass) throw studentErrors.transferClassInvalid();
    if (i.targetClass.branchId !== i.toBranchId) throw studentErrors.transferClassBranch();
    return { moveEnrolment: { enrolmentId: i.enrolment.id, fromClassId: i.enrolment.classId, toClassId: i.targetClass.id } };
}
