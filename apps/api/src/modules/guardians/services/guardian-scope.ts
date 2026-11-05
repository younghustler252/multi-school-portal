import type { Access } from "../../../foundation/access.service";

/*
| WHICH GUARDIANS A PERSON MAY SEE (guardians.view, applied to every read).
|   scope ALL      -> every guardian
|   scope BRANCH   -> the guardians of students in the person's branches. A guardian with children in two branches is seen
|                     by both, but each sees only the children of their own branches. A guardian linked to nobody is seen
|                     only with school-wide access.
|   no permission  -> nobody
*/
const NOBODY = { id: { in: [] as string[] } };

/** A `where` fragment for guardians. `studentId` (the "guardians of this student" filter) must itself be in scope. */
export function guardianScopeWhere(access: Access, studentId?: string): Record<string, unknown> {
    const scope = access.scopeOf("guardians.view");
    if (scope === "ALL") return studentId ? { studentLinks: { some: { studentId } } } : {};
    if (scope === "BRANCH") return { studentLinks: { some: { ...(studentId ? { studentId } : {}), student: { branchId: { in: access.branchScope("guardians.view") as string[] } } } } };
    return NOBODY;
}

/** Which of a guardian's children a viewer may see on the guardian's page: with BRANCH, only those of their branches. */
export function guardianChildrenWhere(access: Access): Record<string, unknown> {
    return access.scopeOf("guardians.view") === "BRANCH" ? { branchId: { in: access.branchScope("guardians.view") as string[] } } : {};
}
