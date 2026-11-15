import type { Access } from "../../../foundation/access.service";
import { rowsOfClassesLedOrTaughtBy } from "../../classes/services/teaching-access";
import type { AttendanceRepository } from "../repositories/attendance.repository";

/*
| WHO MAY SEE OR MARK WHICH ATTENDANCE
|   ALL        -> everything
|   BRANCH     -> staff: the classes that belong to one of their branches (viewing only; attendance.mark never offers BRANCH).
|                 A class has one branch; a person with no branches sees nothing.
|   ASSIGNED   -> a teacher: classes they LEAD (any term) and classes they TEACH
|   OWN        -> a student sees their own; a guardian sees their children's  (view only)
|   no permission -> nobody
| For VIEWING lists, "teach" means this term (like the other modules). For MARKING and for opening a class register,
| "teach" means in the term of the date: last term's assignment gives nothing.
*/
const NOBODY = { id: { in: [] as string[] } };

/** Which attendance ROWS a person may see (used on every list and summary). */
export function attendanceViewWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("attendance.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
    if (scope === "BRANCH" && access.persona === "STAFF") return { class: { branchId: { in: (access.branchScope("attendance.view") as string[] | null) ?? [] } } };
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) {
        return rowsOfClassesLedOrTaughtBy(me);
    }
    if (scope === "OWN" && me) {
        if (access.persona === "STUDENT")  return { studentId: me };
        if (access.persona === "GUARDIAN") return { student: { guardianLinks: { some: { guardianId: me } } } };
    }
    return NOBODY;
}

/** Is this class one the person's scope covers, in this term? (a class register is opened, or taken, class by class) */
export async function classInScope(repo: Pick<AttendanceRepository, "staffCoversClass" | "classInBranches">, access: Access, permission: "attendance.view" | "attendance.mark", classId: string, termId: string): Promise<boolean> {
    const scope = access.scopeOf(permission);
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    // BRANCH is for LOOKING only: marking a register is never granted by branch, even if a role were given it by mistake
    if (scope === "BRANCH") return permission === "attendance.view" && access.persona === "STAFF" && repo.classInBranches(classId, (access.branchScope(permission) as string[] | null) ?? []);
    if (scope !== "ASSIGNED" || access.persona !== "STAFF" || !me) return false;   // OWN / none: not by class
    return repo.staffCoversClass(me, classId, termId);
}

/**
 * May this person look at this ONE student's attendance? Same rules as the lists, so a record lookup never shows
 * more than a list would: ALL -> yes; OWN -> yourself, or a child you are linked to; ASSIGNED / BRANCH -> the student
 * is on the list of a class the scope covers in that term; anything else -> no.
 */
export async function studentInScope(repo: Pick<AttendanceRepository, "enrolledWithin" | "guardianLinked">, access: Access, studentId: string, termId: string): Promise<boolean> {
    const scope = access.scopeOf("attendance.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    if (scope === "OWN") {
        if (!me) return false;
        if (access.persona === "STUDENT")  return me === studentId;
        if (access.persona === "GUARDIAN") return repo.guardianLinked(me, studentId);
        return false;
    }
    if ((scope === "ASSIGNED" || scope === "BRANCH") && access.persona === "STAFF") return repo.enrolledWithin(attendanceViewWhere(access), studentId, termId);
    return false;
}
