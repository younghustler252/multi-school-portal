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

/* ---------- deliberate revocations (see role-revocations.registry.ts) ---------- */

export interface RevocationView { id: string; templateKey: string; permissions: string[]; reason: string }

/** Problems with the revocation list itself, given the templates as the code defines them. Pure. */
export function validateRevocations(
    revocations: RevocationView[],
    codeTemplates: { key: string; locked: boolean; permissions: { key: string }[] }[],
): string[] {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const r of revocations) {
        if (!r.id.trim())                problems.push("revocation without an id");
        else if (seen.has(r.id))         problems.push(`revocation "${r.id}": id used twice`);
        seen.add(r.id);
        if (!r.reason.trim())            problems.push(`revocation "${r.id}": give a reason`);
        if (r.permissions.length === 0)  problems.push(`revocation "${r.id}": no permissions named`);
        const t = codeTemplates.find(x => x.key === r.templateKey);
        if (!t) { problems.push(`revocation "${r.id}": unknown template "${r.templateKey}"`); continue; }
        if (t.locked) problems.push(`revocation "${r.id}": "${t.key}" is locked (it already follows the code exactly)`);
        for (const key of r.permissions) {
            if (t.permissions.some(p => p.key === key)) problems.push(`revocation "${r.id}": "${t.key}" still lists "${key}" in role-templates.registry.ts; take it out there too or the sync would add it back`);
        }
    }
    return problems;
}

export type RevocationAction =
    | { type: "none" }
    | { type: "revoke";  keys: string[] }
    | { type: "pending"; keys: string[]; reason: "customised" }
    | { type: "blocked"; keys: string[]; reason: "template_not_revoked" };

/**
 * What the revocations mean for ONE school role. Pure.
 *   - nothing to remove (the role does not hold the permissions)            -> none
 *   - role not made from an editable template (custom / locked / no source) -> none
 *   - the school customised it                                              -> pending (left alone, listed with what it still holds)
 *   - the platform template still holds one of the permissions              -> blocked (run sync:registries first)
 *   - otherwise                                                             -> revoke those keys
 */
export function planRoleRevocations(role: SchoolRoleView, template: TemplateView | undefined, revocations: RevocationView[]): RevocationAction {
    if (role.kind !== "SYSTEM_EDITABLE" || !role.sourceTemplateKey) return { type: "none" };
    const named = new Set(revocations.filter(r => r.templateKey === role.sourceTemplateKey).flatMap(r => r.permissions));
    const held = role.grants.map(g => g.key).filter(k => named.has(k));
    if (held.length === 0) return { type: "none" };
    if (role.isCustomized) return { type: "pending", keys: held, reason: "customised" };
    if (!template || !template.isActive) return { type: "none" };
    if (held.some(k => template.grants.some(g => g.key === k))) return { type: "blocked", keys: held, reason: "template_not_revoked" };
    return { type: "revoke", keys: held };
}
