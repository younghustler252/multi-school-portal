import type { Access, Scope } from "../../../foundation/access.service";
import type { SchoolEntitlementsView } from "../../../foundation/entitlements.service";

/*
| WHAT THE SIGNED-IN PERSON MAY DO (for the web app: menus, buttons, branch pickers). The API still checks every request;
| this only tells the screen what to show.
|   permissions   every permission with its scope: ALL (whole school), BRANCH (only your branches), ASSIGNED, OWN
|   branches      all    = the school's active branches, for staff only (a student or guardian is not shown the list)
|                 assigned = the branches this person works in (what a BRANCH-scoped permission is limited to)
|                 schoolHasSeveral = more than one active branch: when false, hide every branch picker
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
    /** What the school's plan includes (school sessions only; null for platform sessions). Students and guardians get granted/enforced only, no caps or usage. */
    entitlements: SchoolEntitlementsView | null;
}

/** Staff see the caps and the usage; students and guardians only whether a feature is on. */
export function entitlementsFor(access: Access, view: SchoolEntitlementsView | null): SchoolEntitlementsView | null {
    if (!view || access.realm !== "school") return null;
    if (access.persona === "STAFF") return view;
    return { ...view, status: null, features: view.features.map(f => ({ ...f, value: f.kind === "BOOLEAN" ? f.value : null, unlimited: false, current: null, source: "none" as const })) };
}

export function buildMyPermissions(access: Access, allKeys: ReadonlyArray<string>, activeBranches: BranchRef[]): MyPermissionsResponse {
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
        entitlements: null,
    };
}
