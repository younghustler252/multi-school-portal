import type { Access } from "../../../foundation/access.service";

/*
| WHICH STUDENTS A PERSON MAY SEE (applied to every read).
|   scope ALL      -> every student
|   scope OWN      -> a student sees only themselves; a guardian sees only their linked children
|   BRANCH/ASSIGNED, or no permission -> nobody. A student has no branch of their own and "assigned" depends on
|                    class enrolment, so until Enrolment is switched on these scopes see nothing instead of everything.
*/
const NOBODY = { id: { in: [] as string[] } };

/** A `where` fragment that limits a student query to what the viewer may see. */
export function studentScopeWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("students.view");
    if (scope === "ALL") return {};
    if (scope === "OWN" && access.personaEntityId) {
        if (access.persona === "STUDENT")  return { id: access.personaEntityId };
        if (access.persona === "GUARDIAN") return { guardianLinks: { some: { guardianId: access.personaEntityId } } };
    }
    return NOBODY;
}
