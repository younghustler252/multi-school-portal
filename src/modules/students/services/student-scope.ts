import type { Access } from "../../../foundation/access.service";

/*
| WHICH STUDENTS A PERSON MAY SEE (applied to every read).
|   scope ALL      -> every student
|   scope OWN      -> a student sees only themselves; a guardian sees only their linked children
|   scope ASSIGNED -> a teacher: students enrolled THIS term in a class they lead, or a class they teach this term
|   BRANCH, or no permission -> nobody (a student has no branch of their own; classes are not linked to branches yet)
*/
const NOBODY = { id: { in: [] as string[] } };

/** A `where` fragment that limits a student query to what the viewer may see. */
export function studentScopeWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("students.view");
    if (scope === "ALL") return {};
    if (scope === "ASSIGNED" && access.persona === "STAFF" && access.personaEntityId) {
        const me = access.personaEntityId;
        return { enrolments: { some: { term: { isCurrent: true }, class: { OR: [
            { classTeacherId: me },
            { classSubjects: { some: { staffId: me, term: { isCurrent: true } } } },
        ] } } } };
    }
    if (scope === "OWN" && access.personaEntityId) {
        if (access.persona === "STUDENT")  return { id: access.personaEntityId };
        if (access.persona === "GUARDIAN") return { guardianLinks: { some: { guardianId: access.personaEntityId } } };
    }
    return NOBODY;
}
