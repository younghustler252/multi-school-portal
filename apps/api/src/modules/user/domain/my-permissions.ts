import type { Access, Scope } from "../../../foundation/access.service";
import type { EntitlementFlag } from "../../../foundation/entitlements.service";

/*
| WHAT THE SIGNED-IN PERSON MAY DO (for the web app: menus, buttons, branch pickers). The API still checks every request;
| this only tells the screen what to show.
|   permissions   every permission with its scope: ALL (whole school), BRANCH (only your branches), ASSIGNED, OWN
|   branches      all    = the school's active branches, for staff only (a student or guardian is not shown the list)
|                 assigned = the branches this person works in (what a BRANCH-scoped permission is limited to)
|                 schoolHasSeveral = more than one active branch: when false, hide every branch picker
|   entitlements  what the school's plan (plus platform overrides) lets the school use, by feature key. School sessions only; null for
|                 a platform session. Every known feature is listed. Yes/no features are true/false; limits are { allowed, limit }.
|                 It carries no usage, prices or billing state.
|   entitlementsNotReady  keys of features not switched on yet (always false above; the server does not enforce them). null for a platform session.
| For a given permission: scope ALL -> offer `branches.all`; scope BRANCH -> offer `branches.assigned`.
*/
export interface BranchRef { id: string; name: string; isMain: boolean }

export interface MyPermissionsResponse {
    realm: "school" | "platform";
    persona: "STAFF" | "STUDENT" | "GUARDIAN" | null;
    roles: string[];
    holdsEverything: boolean;
    permissions: Array<{ key: string; scope: Scope }>;
    branches: { all: BranchRef[]; assigned: BranchRef[]; schoolHasSeveral: boolean };
    entitlements: Record<string, EntitlementFlag> | null;
    /** Feature keys that exist but are not switched on yet. Always false in `entitlements`; hide them. The server does not enforce them. null in a platform session. */
    entitlementsNotReady: string[] | null;
}

export function buildMyPermissions(access: Access, allKeys: ReadonlyArray<string>, activeBranches: BranchRef[], entitlements: Record<string, EntitlementFlag> | null = null, notReady: string[] | null = null): MyPermissionsResponse {
    const school = access.realm === "school";
    const staff = school && access.persona === "STAFF";
    return {
        realm: access.realm,
        persona: access.persona,
        roles: [...access.roleKeys].sort(),
        holdsEverything: access.holdsEverything,
        permissions: access.listPermissions(allKeys),
        branches: {
            all: staff ? activeBranches : [],
            assigned: staff ? activeBranches.filter(b => access.branchIds.has(b.id)) : [],
            schoolHasSeveral: school && activeBranches.length > 1,
        },
        entitlements: school ? entitlements : null,
        entitlementsNotReady: school ? notReady : null,
    };
}
