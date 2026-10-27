/*
|--------------------------------------------------------------------------
| ROLE GRANT PLANNER (pure: no database, easy to test)
| Works out what has to change to bring a set of permission grants in line with the wanted set.
|   exact = true   -> add what is missing, fix wrong scopes, remove extras  (locked roles)
|   exact = false  -> only add what is missing; never change or remove      (editable roles)
|--------------------------------------------------------------------------
*/

export interface Grant { key: string; scope: string }

export interface GrantPlan {
    add:    Grant[];      // grants to insert
    rescope: Grant[];     // grants to update to the wanted scope (exact only)
    remove: string[];     // permission keys to delete (exact only)
}

export function planTemplateGrants(current: Grant[], wanted: Grant[], exact: boolean): GrantPlan {
    const have = new Map(current.map(g => [g.key, g.scope]));
    const want = new Map(wanted.map(g => [g.key, g.scope]));

    const add: Grant[] = [];
    const rescope: Grant[] = [];
    const remove: string[] = [];

    for (const [key, scope] of want) {
        if (!have.has(key)) add.push({ key, scope });
        else if (exact && have.get(key) !== scope) rescope.push({ key, scope });
    }
    if (exact) for (const key of have.keys()) if (!want.has(key)) remove.push(key);

    return { add, rescope, remove };
}

export function isEmptyPlan(p: GrantPlan): boolean {
    return p.add.length === 0 && p.rescope.length === 0 && p.remove.length === 0;
}

/* ---------- a school's copy of a role ---------- */

export interface SchoolRoleView {
    id: string;
    name: string;
    kind: "SYSTEM_LOCKED" | "SYSTEM_EDITABLE" | "CUSTOM";
    grantsAll: boolean;
    isCustomized: boolean;
    sourceTemplateKey: string | null;
    sourceTemplateVersion: number | null;
    grants: Grant[];
}

export interface TemplateView {
    key: string;
    version: number;
    isActive: boolean;
    grantsAll: boolean;
    grants: Grant[];
}

export type RoleAction =
    | { type: "skip"; reason: "custom_role" | "no_template" | "template_inactive" | "customised" }
    | { type: "none" }
    | { type: "update"; plan: GrantPlan; grantsAll: boolean | null; version: number; versionOnly: boolean };

/**
 * Decide what to do with ONE school role.
 *  - locked role   -> made exact (grants and grantsAll)
 *  - editable role -> additive only, unless prune is on (then exact)
 *  - customised role, custom role, or a role whose template is gone/inactive -> skipped
 */
export function planSchoolRole(role: SchoolRoleView, template: TemplateView | undefined, prune: boolean): RoleAction {
    if (role.kind === "CUSTOM" || !role.sourceTemplateKey) return { type: "skip", reason: "custom_role" };
    if (role.isCustomized)                                 return { type: "skip", reason: "customised" };
    if (!template)                                         return { type: "skip", reason: "no_template" };
    if (!template.isActive)                                return { type: "skip", reason: "template_inactive" };

    const exact = role.kind === "SYSTEM_LOCKED" || prune;
    const plan = planTemplateGrants(role.grants, template.grants, exact);

    // all-access flag: locked (or prune) follows the template exactly; editable only gains it
    let grantsAll: boolean | null = null;
    if (exact) { if (role.grantsAll !== template.grantsAll) grantsAll = template.grantsAll; }
    else if (template.grantsAll && !role.grantsAll) grantsAll = true;

    const changed = !isEmptyPlan(plan) || grantsAll !== null;
    const versionBehind = role.sourceTemplateVersion !== template.version;

    if (!changed && !versionBehind) return { type: "none" };
    return { type: "update", plan, grantsAll, version: template.version, versionOnly: !changed };
}
