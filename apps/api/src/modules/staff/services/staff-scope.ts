import type { Access } from "../../../foundation/access.service";
import { staffErrors } from "../domain/staff.errors";

/*
| WHO MAY SEE OR MANAGE WHICH STAFF (branch scope applied to staff queries).
|   permission scope ALL    -> every staff member
|   permission scope BRANCH -> staff who work in at least one of the person's branches
|   permission scope OWN    -> only themselves   (staff.view only)
*/

/** A `where` fragment that limits a staff query to what the viewer's scope allows. */
export function staffScopeWhere(access: Access, key: "staff.view" | "staff.manage"): Record<string, unknown> {
    const scope = access.branchScope(key);
    if (scope === "ALL") return {};
    if (Array.isArray(scope)) return { branches: { some: { branchId: { in: scope } } } };
    // OWN (or not held): only their own record
    return { id: access.personaEntityId ?? "no-such-staff" };
}

/** True when this person may act on that staff member (branch ids of the staff member are needed for BRANCH scope). */
export function canActOnStaff(access: Access, key: "staff.view" | "staff.manage", staffId: string, staffBranchIds: string[]): boolean {
    const scope = access.branchScope(key);
    if (scope === "ALL") return true;
    if (Array.isArray(scope)) return staffBranchIds.some(b => scope.includes(b));
    return access.personaEntityId === staffId;            // OWN
}

export function assertCanActOnStaff(access: Access, key: "staff.view" | "staff.manage", staffId: string, staffBranchIds: string[]): void {
    if (!canActOnStaff(access, key, staffId, staffBranchIds)) throw staffErrors.outOfScope();
}
