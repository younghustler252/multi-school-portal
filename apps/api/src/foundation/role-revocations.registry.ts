/*
|--------------------------------------------------------------------------
| ROLE REVOCATIONS: DELIBERATE, NAMED REMOVALS OF PERMISSIONS FROM DEFAULT ROLES
|--------------------------------------------------------------------------
| The normal sync only ever ADDS permissions to an editable default role (the platform and the schools own those
| roles, so the code never takes anything away by itself). When a default role must LOSE a permission, say so here,
| by name. Nothing else is ever removed.
|
| What a revocation does, and where:
|   `npm run sync:registries`    removes the named permissions from the platform's TEMPLATE for that role (version +1).
|   `npm run sync:school-roles`  removes them from each school's copy of that role, but ONLY when the school has not
|                                changed the role (isCustomized = false). A role the school has customised is NEVER
|                                touched: it is listed in the report ("pending") with the permissions it still holds, so
|                                the school can be handled one by one.
|
| Rules (checked on every sync; a revocation that breaks one is reported as a conflict and not applied):
|   - Take the permission OUT of the role's list in role-templates.registry.ts in the same change. If the code still
|     lists it, the additive sync would put it straight back.
|   - Only editable templates can be revoked from. Locked templates already follow the code exactly.
|   - Every revocation has a unique `id` and a `reason`. Once applied everywhere, leave it in the list: repeating it is
|     harmless, and it keeps the history of why a default changed. Remove it only when nobody needs that history.
|   - Run order: sync:registries first, then sync:school-roles. A school is not touched until the template is revoked.
|--------------------------------------------------------------------------
*/

export interface RoleRevocation {
    /** Unique, stable name for this decision, e.g. "2026-11-principal-config-to-admin". */
    id: string;
    /** The template key of the default role (e.g. "principal"). */
    templateKey: string;
    /** The permission keys the role must no longer hold. */
    permissions: string[];
    /** Why, in plain words. Shown in the sync report. */
    reason: string;
}

export const ROLE_REVOCATIONS: RoleRevocation[] = [];
