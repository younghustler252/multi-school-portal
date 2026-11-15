import { planSchoolRole, planRoleRevocations, type Grant, type SchoolRoleView, type TemplateView, type RoleAction } from "./role-grants.planner";
import { ROLE_REVOCATIONS, type RoleRevocation } from "./role-revocations.registry";

/*
|--------------------------------------------------------------------------
| SCHOOL ROLE SYNC
| Brings each school's copy of a default role up to date with its platform template.
| Run after `npm run sync:registries`:  npm run sync:school-roles  (add :dry-run to preview)
|  - locked roles        -> made exactly equal to the template
|  - editable roles      -> only gain missing permissions (nothing removed) unless --prune
|  - customised roles    -> skipped and listed in the report
|  - deliberate revocations (role-revocations.registry.ts): the named permissions are removed from roles the school has NOT
|    changed; a customised role is never touched, and is listed as "pending" with what it still holds
| One transaction per school; a failure rolls that school back and the run continues.
|--------------------------------------------------------------------------
*/

/** The smallest slice of a pg client we need (so tests can pass a real one). */
export interface SqlClient { query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }> }

export interface SchoolRoleSyncReport {
    updated:  { role: string; added: number; rescoped: number; removed: number; grantsAll: boolean | null }[];
    versionOnly: string[];
    unchanged: number;
    skipped:  { role: string; reason: string }[];
    /** Named permissions removed from untouched roles (a dry run lists them without removing). */
    revoked:  { role: string; keys: string[] }[];
    /** Customised roles that still hold a revoked permission: left alone, to be decided school by school. */
    pendingRevocations: { role: string; keys: string[] }[];
    /** Roles not touched because the platform template still holds the permission (run sync:registries first). */
    blockedRevocations: { role: string; keys: string[] }[];
}

export async function loadTemplateViews(prisma: any): Promise<Map<string, TemplateView>> {
    const rows = await prisma.roleTemplate.findMany({ include: { permissions: true } });
    return new Map(rows.map((t: any) => [t.key, {
        key: t.key, version: t.version, isActive: t.isActive, grantsAll: t.grantsAll,
        grants: t.permissions.map((p: any) => ({ key: p.permissionKey, scope: p.scope })),
    } as TemplateView]));
}

async function loadRoles(client: SqlClient): Promise<SchoolRoleView[]> {
    const roles = await client.query(
        `SELECT id, name, kind::text AS kind, "grantsAll", "isCustomized", "sourceTemplateKey", "sourceTemplateVersion"
           FROM "SchoolRole" WHERE "deletedAt" IS NULL AND "sourceTemplateKey" IS NOT NULL`);
    const perms = await client.query(`SELECT "roleId", "permissionKey", scope::text AS scope FROM "SchoolRolePermission"`);
    const byRole = new Map<string, Grant[]>();
    for (const p of perms.rows) {
        if (!byRole.has(p.roleId)) byRole.set(p.roleId, []);
        byRole.get(p.roleId)!.push({ key: p.permissionKey, scope: p.scope });
    }
    return roles.rows.map((r: any) => ({ ...r, grants: byRole.get(r.id) ?? [] }));
}

/** Plan only (no writes): what would happen to every role in this school. */
export async function planSchool(client: SqlClient, templates: Map<string, TemplateView>, prune: boolean) {
    const roles = await loadRoles(client);
    return roles.map(role => ({ role, action: planSchoolRole(role, templates.get(role.sourceTemplateKey!), prune) }));
}

async function applyAction(client: SqlClient, roleId: string, a: Extract<RoleAction, { type: "update" }>) {
    for (const g of a.plan.add) {
        await client.query(
            `INSERT INTO "SchoolRolePermission" ("roleId","permissionKey",scope) VALUES ($1,$2,$3::"PermissionScope")
             ON CONFLICT ("roleId","permissionKey") DO NOTHING`, [roleId, g.key, g.scope]);
    }
    for (const g of a.plan.rescope) {
        await client.query(`UPDATE "SchoolRolePermission" SET scope = $3::"PermissionScope" WHERE "roleId" = $1 AND "permissionKey" = $2`, [roleId, g.key, g.scope]);
    }
    if (a.plan.remove.length) {
        await client.query(`DELETE FROM "SchoolRolePermission" WHERE "roleId" = $1 AND "permissionKey" = ANY($2::text[])`, [roleId, a.plan.remove]);
    }
    await client.query(
        `UPDATE "SchoolRole" SET "sourceTemplateVersion" = $2, "grantsAll" = COALESCE($3, "grantsAll"), "updatedAt" = now() WHERE id = $1`,
        [roleId, a.version, a.grantsAll]);
}

/** Sync ONE school (client already pointed at the school's schema). Caller handles BEGIN/COMMIT. */
export async function syncSchoolRoles(client: SqlClient, templates: Map<string, TemplateView>, opts: { prune: boolean; dryRun: boolean; revocations?: RoleRevocation[] }): Promise<SchoolRoleSyncReport> {
    const report: SchoolRoleSyncReport = { updated: [], versionOnly: [], unchanged: 0, skipped: [], revoked: [], pendingRevocations: [], blockedRevocations: [] };
    const revocations = opts.revocations ?? ROLE_REVOCATIONS;
    for (const { role, action } of await planSchool(client, templates, opts.prune)) {
        // deliberate revocations first: only ever the named permissions, only ever on an untouched role
        const rv = planRoleRevocations(role, templates.get(role.sourceTemplateKey!), revocations);
        if (rv.type === "pending") report.pendingRevocations.push({ role: role.name, keys: rv.keys });
        else if (rv.type === "blocked") report.blockedRevocations.push({ role: role.name, keys: rv.keys });
        else if (rv.type === "revoke") {
            if (!opts.dryRun) await client.query(`DELETE FROM "SchoolRolePermission" WHERE "roleId" = $1 AND "permissionKey" = ANY($2::text[])`, [role.id, rv.keys]);
            report.revoked.push({ role: role.name, keys: rv.keys });
        }
        if (action.type === "skip")  { report.skipped.push({ role: role.name, reason: action.reason }); continue; }
        if (action.type === "none")  { report.unchanged++; continue; }
        if (!opts.dryRun) await applyAction(client, role.id, action);
        if (action.versionOnly) report.versionOnly.push(role.name);
        else report.updated.push({ role: role.name, added: action.plan.add.length, rescoped: action.plan.rescope.length, removed: action.plan.remove.length, grantsAll: action.grantsAll });
    }
    return report;
}
