/*
| GET /users/me/permissions: what the signed-in session may do. Build menus, buttons and branch pickers from this.
| The API checks every request anyway; this only decides what to SHOW.
*/
export type Scope = "ALL" | "BRANCH" | "ASSIGNED" | "OWN";
export interface BranchRef { id: string; name: string; isMain: boolean }

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
    };
}
