import type { Access } from "../../../foundation/access.service";

import { classLedBy, leadsClass } from "../../classes/services/teaching-access";
/*
| WHO MAY SEE OR WORK ON WHICH REPORT CARD
|   ALL        -> every card
|   BRANCH     -> staff: the cards of classes that belong to one of their branches (viewing only; same rule as grades)
|   ASSIGNED   -> staff: the cards of the classes they LEAD (class teacher)
|   OWN        -> a student sees their own card, a guardian their children's, and ONLY once it is published
|   no permission -> nobody
| Building cards and writing the teacher's remark: ALL, or the class teacher of that class.
*/
const NOBODY = { id: { in: [] as string[] } };
/** The branches a BRANCH-scoped permission is limited to (empty = none, which matches nothing). */
const branchIdsOf = (access: Access): string[] => (access.branchScope("report_cards.view") as string[] | null) ?? [];
const VISIBLE = { status: { in: ["published", "sent"] } };

/** Which ReportCard rows a person may see. */
export function cardsViewWhere(access: Access): Record<string, unknown> {
    const scope = access.scopeOf("report_cards.view");
    const me = access.personaEntityId;
    if (scope === "ALL") return {};
    if (scope === "BRANCH" && access.persona === "STAFF") return { class: { branchId: { in: branchIdsOf(access) } } };
    if (scope === "ASSIGNED" && access.persona === "STAFF" && me) return { class: classLedBy(me) };
    if (scope === "OWN" && me) {
        if (access.persona === "STUDENT")  return { studentId: me, ...VISIBLE };
        if (access.persona === "GUARDIAN") return { student: { guardianLinks: { some: { guardianId: me } } }, ...VISIBLE };
    }
    return NOBODY;
}

/** Staff who may look at a whole class (the build / publish screens). Students and guardians never. */
export function mayViewClass(access: Access, classTeacherId: string | null, branchId?: string | null): boolean {
    const scope = access.scopeOf("report_cards.view");
    if (scope === "ALL") return true;
    // a class's branch decides; a caller that does not know it is refused (fail closed)
    if (scope === "BRANCH") return access.persona === "STAFF" && !!branchId && access.canActInBranch("report_cards.view", branchId);
    return scope === "ASSIGNED" && access.persona === "STAFF" && leadsClass(access.personaEntityId, classTeacherId);
}

/** Build cards and write the teacher's remark for this class. */
export function mayWorkOnClass(access: Access, classTeacherId: string | null): boolean {
    if (!access.can("report_cards.generate")) return false;
    const scope = access.scopeOf("report_cards.generate");
    if (scope === "ALL") return true;
    return scope === "ASSIGNED" && access.persona === "STAFF" && leadsClass(access.personaEntityId, classTeacherId);
}

export const isFamily = (access: Access): boolean => access.scopeOf("report_cards.view") === "OWN";
