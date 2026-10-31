import type { Access } from "../../../foundation/access.service";

/*
| WHO MAY SEE OR WORK ON WHICH MARK SHEET
|   ALL        -> everything
|   ASSIGNED   -> staff: the sheets of subjects they TEACH, and (to look at, not to change) every subject of a class they LEAD
|   OWN        -> a student sees their own grades, a guardian their children's, and ONLY once the sheet is published
|   BRANCH, or no permission -> nobody (classes are not linked to branches yet)
| Entering and submitting is stricter than seeing: ASSIGNED means the teacher of THAT subject, not the class teacher.
*/
const NOBODY = { id: { in: [] as string[] } };
const PUBLISHED = { sheet: { status: { in: ["published", "locked"] } } };

/** Which Grade rows a person may see (used on the results list). */
export function gradesViewWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("grades.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
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
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) return { OR: [{ staffId: me }, { class: { classTeacherId: me } }] };
    return NOBODY;
}

export interface SheetOwner { staffId: string | null; classTeacherId: string | null }

export function mayViewSheet(access: Access, o: SheetOwner): boolean {
    const scope = access.scopeOf("grades.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    return scope === "ASSIGNED" && access.persona === "STAFF" && !!me && (o.staffId === me || o.classTeacherId === me);
}

/** Enter scores or submit: ALL, or the teacher of that subject. */
export function mayWorkOnSheet(access: Access, permission: "grades.enter" | "grades.submit", o: SheetOwner): boolean {
    const scope = access.scopeOf(permission);
    const me = access.personaEntityId;
    if (scope === "ALL") return true;
    return scope === "ASSIGNED" && access.persona === "STAFF" && !!me && o.staffId === me;
}
