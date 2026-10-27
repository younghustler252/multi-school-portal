import type { PrismaClient } from "../generated/public/client";
import { ROLE_TEMPLATES } from "./role-templates.registry";
import { permissionByKey } from "./permissions.registry";
import { planTemplateGrants, isEmptyPlan } from "./role-grants.planner";

/*
|--------------------------------------------------------------------------
| ROLE TEMPLATE SYNC (run AFTER the permission sync: templates reference permission keys)
|  - new template      -> created with its starting permissions
|  - LOCKED template   -> its settings AND its permissions are made to equal the code every deploy
|                         (missing added, wrong scopes fixed, extras removed)
|  - editable template -> permissions the code lists but the template lacks are ADDED; nothing is ever
|                         changed or removed (the platform owns it). Known limit: until the platform role
|                         console records deliberate removals, an editable template cannot keep a grant
|                         the code lists.
| Whenever a template's permissions change, its version goes up by 1. Schools' copies of roles are updated
| from the templates by `npm run sync:school-roles`.
| A template that grants an unknown key, a scope the key does not allow, or a key the template's persona
| cannot hold is reported as a conflict and not created.
|--------------------------------------------------------------------------
*/

export interface RoleTemplateSyncReport { created: string[]; enforced: string[]; kept: string[]; grantsChanged: string[]; conflicts: string[] }

export async function syncRoleTemplates(prisma: PrismaClient): Promise<RoleTemplateSyncReport> {
    const report: RoleTemplateSyncReport = { created: [], enforced: [], kept: [], grantsChanged: [], conflicts: [] };

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

        const row = await prisma.roleTemplate.findUnique({ where: { key: t.key }, include: { permissions: true } });

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

        // ---- permissions: locked = exact, editable = additive only ----
        const plan = planTemplateGrants(
            row.permissions.map(p => ({ key: p.permissionKey, scope: p.scope })),
            t.permissions.map(g => ({ key: g.key, scope: g.scope })),
            t.locked,
        );
        let grantsChanged = false;
        if (!isEmptyPlan(plan)) {
            await prisma.$transaction(async (tx) => {
                if (plan.add.length)    await tx.roleTemplatePermission.createMany({ data: plan.add.map(g => ({ templateId: row.id, permissionKey: g.key, scope: g.scope as any })) });
                for (const g of plan.rescope) await tx.roleTemplatePermission.update({ where: { templateId_permissionKey: { templateId: row.id, permissionKey: g.key } }, data: { scope: g.scope as any } });
                if (plan.remove.length) await tx.roleTemplatePermission.deleteMany({ where: { templateId: row.id, permissionKey: { in: plan.remove } } });
                await tx.roleTemplate.update({ where: { id: row.id }, data: { version: { increment: 1 } } });
            });
            grantsChanged = true;
            report.grantsChanged.push(`${t.key}: +${plan.add.length} ~${plan.rescope.length} -${plan.remove.length}`);
        }

        if (!t.locked) { if (!grantsChanged) report.kept.push(t.key); continue; }

        // ---- locked template settings ----
        const patch: Record<string, unknown> = {};
        if (!row.isLocked)                                        patch.isLocked = true;
        if (row.grantsAll !== t.grantsAll)                        patch.grantsAll = t.grantsAll;
        if (row.persona !== t.persona)                            patch.persona = t.persona;
        if ((row.defaultForPersona ?? null) !== (t.defaultForPersona ?? null)) patch.defaultForPersona = t.defaultForPersona ?? null;
        if (!row.isActive)                                        patch.isActive = true;
        if (!row.autoProvision)                                   patch.autoProvision = true;

        if (Object.keys(patch).length) { await prisma.roleTemplate.update({ where: { key: t.key }, data: patch }); report.enforced.push(t.key); }
        else if (!grantsChanged) report.kept.push(t.key);
    }
    return report;
}
