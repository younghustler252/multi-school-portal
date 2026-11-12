import type { Access } from "../../../foundation/access.service";
import { resolveAudience } from "../../notifications/domain/audience";
import { eventErrors } from "./event.errors";
import { includesStaff } from "./event.policy";
import type { CalendarEventEntity, EventAudienceKind } from "./event.entity";

/*
| WHO MAY MANAGE WHICH EVENT (pure). A person with events.manage / events.publish at ALL scope may act on any event.
| At BRANCH scope they may act only on events aimed at their own branches: a school-wide event (no branch narrowing) is not theirs.
| Choosing the audience of a NEW event uses the same rule as announcements (notifications/domain/audience.ts):
| a branch-limited person gets their own branches by default and is refused any other.
*/
export type EventPermission = "events.manage" | "events.publish";

export function audienceScope(
    access: Access | undefined, key: EventPermission,
    input: { audienceKinds: readonly EventAudienceKind[]; branchIds?: string[]; classIds?: string[] },
    classBranch: Map<string, string>,
): { branchIds: string[]; classIds: string[]; limited: boolean } {
    // resolveAudience only needs to know whether staff are included (classes are refused then)
    const targetType = includesStaff(input.audienceKinds) ? "EVERYONE" : "ALL_STUDENTS";
    try {
        const { filter, limited } = resolveAudience(access, { targetType, branchIds: input.branchIds, classIds: input.classIds }, classBranch, key);
        return { branchIds: filter.branchIds ?? [], classIds: filter.classIds ?? [], limited };
    } catch (e: any) {
        if (e?.code === "AUDIENCE_OUT_OF_SCOPE") throw eventErrors.outOfScope();
        if (e?.code === "CLASS_AUDIENCE_NOT_FOR_STAFF") throw eventErrors.classWithStaff();
        throw e;
    }
}

/** May this person act on this existing event with this permission? */
export function canActOnEvent(access: Access | undefined, key: EventPermission, event: Pick<CalendarEventEntity, "branchIds">): boolean {
    if (!access) return true;                               // no sender context (a background job)
    const scope = access.branchScope(key);
    if (scope === "ALL") return true;
    if (!Array.isArray(scope) || scope.length === 0) return false;
    return event.branchIds.length > 0 && event.branchIds.every(b => scope.includes(b));
}

export function assertCanActOnEvent(access: Access | undefined, key: EventPermission, event: Pick<CalendarEventEntity, "branchIds">): void {
    if (!canActOnEvent(access, key, event)) throw eventErrors.outOfScope();
}

/** Can this person see drafts and every event (rather than only what is meant for them)? */
export const seesEveryEvent = (access: Access | undefined): boolean =>
    !!access && (access.can("events.manage") || access.can("events.publish"));
