/*
| GET /users/me/permissions: what the signed-in session may do. Build menus, buttons and branch pickers from this.
| The API checks every request anyway; this only decides what to SHOW.
*/
export type Scope = "ALL" | "BRANCH" | "ASSIGNED" | "OWN";
export interface BranchRef { id: string; name: string; isMain: boolean }

/** Yes/no features are true/false. Limit and quota features are { allowed, limit }: limit null = unlimited, 0 = not granted. */
export type EntitlementFlag = boolean | { allowed: boolean; limit: number | null };

export interface MyPermissions {
    realm: "school" | "platform";
    persona: "STAFF" | "STUDENT" | "GUARDIAN" | null;
    roles: string[];
    /** A school admin: holds every permission (they are all listed, at scope ALL). */
    holdsEverything: boolean;
    permissions: Array<{ key: string; scope: Scope }>;
    branches: {
        /** The school's active branches (staff only). Offer these for a permission held at scope ALL. */
        all: BranchRef[];
        /** The branches this person works in. Offer these for a permission held at scope BRANCH. */
        assigned: BranchRef[];
        /** false = the school has one branch: hide every branch picker. */
        schoolHasSeveral: boolean;
    };
    /**
     * What the school's plan (plus any platform override) lets it use, by feature key, e.g. entitlements["modules.fees"] === true.
     * Every known feature is present (a missing key never means "maybe"). true = the school may use it: it is switched on AND
     * the server's gate lets it through. That is NOT always "the plan lists it": a feature whose enforcement is WARN is let through
     * (and only flagged server-side) even when the plan does not grant it, so it shows true. Do not read true as "included in the plan".
     * false has two causes: the plan does not grant it (the server answers 403 FEATURE_NOT_AVAILABLE on a gated route),
     * or the feature is not switched on yet (listed in `entitlementsNotReady`; the server does NOT enforce those, so do not
     * read false as a 403 for them; just do not offer the feature). No usage, prices or plan names. null in a platform session.
     */
    entitlements: Record<string, EntitlementFlag> | null;
    /** Feature keys that exist but are not switched on yet; always false in `entitlements`. null in a platform session. */
    entitlementsNotReady: string[] | null;
}

const RANK: Record<Scope, number> = { OWN: 1, ASSIGNED: 2, BRANCH: 3, ALL: 4 };

/** The small helper the web app uses everywhere:  const me = accessOf(response);  me.can("students.transfer") */
export function accessOf(p: MyPermissions) {
    const scopes = new Map(p.permissions.map(x => [x.key, x.scope] as const));
    const scopeOf = (key: string): Scope | null => scopes.get(key) ?? null;
    return {
        /** Does the person hold this permission (at any scope)? */
        can: (key: string): boolean => scopes.has(key),
        /** Do they hold it at least as widely as `needed`? (ALL > BRANCH > ASSIGNED > OWN) */
        canAtLeast: (key: string, needed: Scope): boolean => { const s = scopeOf(key); return s !== null && RANK[s] >= RANK[needed]; },
        scopeOf,
        /** The branches to offer in a picker for this permission: all of them (scope ALL), only theirs (BRANCH), none otherwise. Empty when the school has one branch. */
        branchChoices: (key: string): BranchRef[] => {
            if (!p.branches.schoolHasSeveral) return [];
            const s = scopeOf(key);
            return s === "ALL" ? p.branches.all : s === "BRANCH" ? p.branches.assigned : [];
        },
        /** Is any of these held? (for a menu entry that several permissions can open) */
        canAny: (...keys: string[]): boolean => keys.some(k => scopes.has(k)),
        /** Is this plan feature available to the school? (limit features count as available when allowed) */
        hasFeature: (key: string): boolean => { const f = p.entitlements?.[key]; return typeof f === "object" && f !== null ? f.allowed : f === true; },
    };
}
