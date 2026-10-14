import type { PrismaClient } from "../generated/public/client";
import { ROLE_TEMPLATES } from "./role-templates.registry";
import { permissionByKey } from "./permissions.registry";

/*
|--------------------------------------------------------------------------
| ROLE TEMPLATE SYNC (run AFTER the permission sync: templates reference permission keys)
|  - new template      -> created with its starting permissions
|  - LOCKED template   -> its locked / all-access / persona / default-for-persona settings are enforced every
|                         deploy; its permissions are not touched
|  - editable template -> created once, then never overwritten (the platform owns it)
| A template that grants an unknown key, a scope the key does not allow, or a key the template's persona
| cannot hold is reported as a conflict and not created.
|--------------------------------------------------------------------------
*/

export interface RoleTemplateSyncReport { created: string[]; enforced: string[]; kept: string[]; conflicts: string[] }

export async function syncRoleTemplates(prisma: PrismaClient): Promise<RoleTemplateSyncReport> {
    const report: RoleTemplateSyncReport = { created: [], enforced: [], kept: [], conflicts: [] };

    for (const t of ROLE_TEMPLATES) {
        // validate the grants against the registry
        const problems: string[] = [];
        for (const g of t.permissions) {
            const def = permissionByKey(g.key);
            if (!def) problems.push(`${t.key}: unknown permission "${g.key}"`);
            else {
                if (!def.scopes.includes(g.scope))     problems.push(`${t.key}: "${g.key}" does not allow scope ${g.scope}`);
                if (!def.personas.includes(t.persona)) problems.push(`${t.key}: "${g.key}" cannot be held by persona ${t.persona}`);
                if (def.realm !== "SCHOOL")            problems.push(`${t.key}: "${g.key}" is not a school permission`);
            }
        }
        if (problems.length) { report.conflicts.push(...problems); continue; }

        const row = await prisma.roleTemplate.findUnique({ where: { key: t.key } });

        if (!row) {
            await prisma.roleTemplate.create({
                data: {
                    key: t.key, name: t.name, description: t.description, persona: t.persona,
                    isLocked: t.locked, grantsAll: t.grantsAll, autoProvision: true,
                    defaultForPersona: t.defaultForPersona ?? null, sortOrder: t.sortOrder,
                    permissions: { create: t.permissions.map(g => ({ permissionKey: g.key, scope: g.scope })) },
                },
            });
            report.created.push(t.key);
            continue;
        }

        if (!t.locked) { report.kept.push(t.key); continue; }

        const patch: Record<string, unknown> = {};
        if (!row.isLocked)                                        patch.isLocked = true;
        if (row.grantsAll !== t.grantsAll)                        patch.grantsAll = t.grantsAll;
        if (row.persona !== t.persona)                            patch.persona = t.persona;
        if ((row.defaultForPersona ?? null) !== (t.defaultForPersona ?? null)) patch.defaultForPersona = t.defaultForPersona ?? null;
        if (!row.isActive)                                        patch.isActive = true;
        if (!row.autoProvision)                                   patch.autoProvision = true;

        if (Object.keys(patch).length) { await prisma.roleTemplate.update({ where: { key: t.key }, data: patch }); report.enforced.push(t.key); }
        else report.kept.push(t.key);
    }
    return report;
}
