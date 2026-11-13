import type { Access } from "../../../foundation/access.service";

/*
| WHO MAY SEE OR WORK ON WHICH MARK SHEET
|   ALL        -> everything
|   BRANCH     -> (viewing only) every sheet and result of a class that belongs to one of the viewer's branches
|   ASSIGNED   -> staff: the sheets of subjects they TEACH, and (to look at, not to change) every subject of a class they LEAD
|   OWN        -> a student sees their own grades, a guardian their children's, and ONLY once the sheet is published
|   no permission -> nobody
| Entering and submitting is stricter than seeing: ASSIGNED means the teacher of THAT subject, not the class teacher.
| (grades.enter / grades.submit never offer BRANCH, so a branch person can look but not change.)
| A class belongs to one branch, so BRANCH is decided by the class's branchId. A person with no branches sees nothing.
*/
const NOBODY = { id: { in: [] as string[] } };
/** The branches a BRANCH-scoped permission is limited to (empty = none, which matches nothing). */
const branchIdsOf = (access: Access): string[] => (access.branchScope("grades.view") as string[] | null) ?? [];
const PUBLISHED = { sheet: { status: { in: ["published", "locked"] } } };

/** Which Grade rows a person may see (used on the results list). */
export function gradesViewWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("grades.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
    if (scope === "BRANCH" && access.persona === "STAFF") return { classSubject: { class: { branchId: { in: branchIdsOf(access) } } } };
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) return { classSubject: { OR: [{ staffId: me }, { class: { classTeacherId: me } }] } };
    if (scope === "OWN" && me) {
        if (access.persona === "STUDENT")  return { studentId: me, ...PUBLISHED };
        if (access.persona === "GUARDIAN") return { student: { guardianLinks: { some: { guardianId: me } } }, ...PUBLISHED };
    }
    return NOBODY;
}

/** Which class-subjects (sheets) a staff member may list. */
export function sheetsViewWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("grades.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
    if (scope === "BRANCH" && access.persona === "STAFF") return { class: { branchId: { in: branchIdsOf(access) } } };
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) return { OR: [{ staffId: me }, { class: { classTeacherId: me } }] };
    return NOBODY;
}

/** `branchId` is the class's branch. Left out, a BRANCH-scoped viewer is refused (fail closed), never let through. */
export interface SheetOwner { staffId: string | null; classTeacherId: string | null; branchId?: string | null }

export function mayViewSheet(access: Access, o: SheetOwner): boolean {
    const scope = access.scopeOf("grades.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    if (scope === "BRANCH") return access.persona === "STAFF" && !!o.branchId && access.canActInBranch("grades.view", o.branchId);
    return scope === "ASSIGNED" && access.persona === "STAFF" && !!me && (o.staffId === me || o.classTeacherId === me);
}

/** Enter scores or submit: ALL, or the teacher of that subject. */
export function mayWorkOnSheet(access: Access, permission: "grades.enter" | "grades.submit", o: SheetOwner): boolean {
    const scope = access.scopeOf(permission);
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    return scope === "ASSIGNED" && access.persona === "STAFF" && !!me && o.staffId === me;
}
