/*
| GET /users/me/permissions: what the signed-in session may do. Build menus, buttons and branch pickers from this.
| The API checks every request anyway; this only decides what to SHOW.
*/
export type Scope = "ALL" | "BRANCH" | "ASSIGNED" | "OWN";
export interface BranchRef { id: string; name: string; isMain: boolean }

export interface SchoolFeature {
    key: string;
    kind: "BOOLEAN" | "LIMIT" | "QUOTA" | "ENUM";
    enforcement: "BLOCK" | "WARN";
    /** false = the platform does not enforce this feature yet, so it is open to everyone. */
    enforced: boolean;
    /** Does the school's plan (or an override) include it right now? */
    granted: boolean;
    /** BOOLEAN: on/off. LIMIT/QUOTA: the cap (null = unlimited, 0 = none). ENUM: the chosen value. Students and guardians get null for non-boolean features. */
    value: boolean | number | string | null;
    unlimited: boolean;
    /** Current usage of a metered limit (staff only); null otherwise. */
    current: number | null;
    source: "plan" | "override" | "none";
}
/** What the school's plan includes. Staff get caps and usage; students and guardians only on/off. */
export interface SchoolEntitlements {
    subscribed: boolean;
    /** Subscription status (staff only). */
    status: string | null;
    features: SchoolFeature[];
}

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
    /** The school's plan entitlements (school sessions only; null for platform sessions, absent from older APIs). */
    entitlements?: SchoolEntitlements | null;
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
        /** Does the school's plan include this feature? True when unknown (no entitlements sent, or an unknown key), so a menu is never hidden by a missing answer; the API still enforces. */
        hasFeature: (key: string): boolean => {
            const f = p.entitlements?.features.find(x => x.key === key);
            return f ? f.granted : true;
        },
        /** A metered limit: { limit (null = unlimited), current, atLimit }; null when not a metered limit or not visible to this person. */
        limitOf: (key: string): { limit: number | null; current: number; atLimit: boolean } | null => {
            const f = p.entitlements?.features.find(x => x.key === key);
            if (!f || (f.kind !== "LIMIT" && f.kind !== "QUOTA") || f.current === null || f.value === null && !f.unlimited) return null;
            const limit = f.unlimited ? null : (f.value as number);
            return { limit, current: f.current, atLimit: limit !== null && f.current >= limit };
        },
        /** Is any of these held? (for a menu entry that several permissions can open) */
        canAny: (...keys: string[]): boolean => keys.some(k => scopes.has(k)),
    };
}
