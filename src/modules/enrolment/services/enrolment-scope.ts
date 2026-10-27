import type { Access } from "../../../foundation/access.service";

/*
| WHICH ENROLMENTS A PERSON MAY SEE (applied to every read).
|   ALL        -> everything
|   ASSIGNED   -> a teacher: the classes they LEAD (any term) and the classes they TEACH this term
|   OWN        -> a student sees their own; a guardian sees their children's
|   BRANCH, or no permission -> nobody (classes are not linked to branches yet)
*/
const NOBODY = { id: { in: [] as string[] } };

export function enrolmentScopeWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("enrolment.view");
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
