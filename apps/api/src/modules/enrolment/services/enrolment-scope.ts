import type { Access } from "../../../foundation/access.service";

import { rowsOfClassesLedOrTaughtBy } from "../../classes/services/teaching-access";
/*
| WHICH ENROLMENTS A PERSON MAY SEE (applied to every read).
|   ALL        -> everything
|   BRANCH     -> staff: the enrolments in classes that belong to one of their branches (a class has one branch;
|                 a person with no branches sees nothing)
|   ASSIGNED   -> a teacher: the classes they LEAD (any term) and the classes they TEACH this term
|   OWN        -> a student sees their own; a guardian sees their children's
|   no permission -> nobody
*/
const NOBODY = { id: { in: [] as string[] } };

export function enrolmentScopeWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("enrolment.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
    if (scope === "BRANCH" && access.persona === "STAFF") return { class: { branchId: { in: (access.branchScope("enrolment.view") as string[] | null) ?? [] } } };
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) {
        return rowsOfClassesLedOrTaughtBy(me);
    }
    if (scope === "OWN" && me) {
        if (access.persona === "STUDENT")  return { studentId: me };
        if (access.persona === "GUARDIAN") return { student: { guardianLinks: { some: { guardianId: me } } } };
    }
    return NOBODY;
}
