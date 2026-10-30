import type { Access } from "../../../foundation/access.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";

/*
| WHO MAY SEE OR MARK WHICH ATTENDANCE
|   ALL        -> everything
|   ASSIGNED   -> a teacher: classes they LEAD (any term) and classes they TEACH
|   OWN        -> a student sees their own; a guardian sees their children's  (view only)
|   BRANCH, or no permission -> nobody (classes are not linked to branches yet)
| For VIEWING lists, "teach" means this term (like the other modules). For MARKING and for opening a class register,
| "teach" means in the term of the date: last term's assignment gives nothing.
*/
const NOBODY = { id: { in: [] as string[] } };

/** Which attendance ROWS a person may see (used on every list and summary). */
export function attendanceViewWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("attendance.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) {
        return { OR: [
            { class: { classTeacherId: me } },
            { term: { isCurrent: true }, class: { classSubjects: { some: { staffId: me, term: { isCurrent: true } } } } },
        ] };
    }
    if (scope === "OWN" && me) {
        if (access.persona === "STUDENT")  return { studentId: me };
        if (access.persona === "GUARDIAN") return { student: { guardianLinks: { some: { guardianId: me } } } };
    }
    return NOBODY;
}

/** Is this class one the person's scope covers, in this term? (a class register is opened, or taken, class by class) */
export async function classInScope(access: Access, permission: "attendance.view" | "attendance.mark", classId: string, termId: string): Promise<boolean> {
    const scope = access.scopeOf(permission);
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    if (scope !== "ASSIGNED" || access.persona !== "STAFF" || !me) return false;   // OWN / BRANCH / none: not by class
    const db = getTenantClient();
    const [leads, teaches] = await Promise.all([
        db.class.count({ where: { id: classId, classTeacherId: me } }),
        db.classSubject.count({ where: { classId, termId, staffId: me } }),
    ]);
    return leads > 0 || teaches > 0;
}
