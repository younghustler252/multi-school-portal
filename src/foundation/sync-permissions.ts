import type { PrismaClient } from "../generated/public/client";
import { PERMISSION_REGISTRY } from "./permissions.registry";

/*
|--------------------------------------------------------------------------
| PERMISSION SYNC (run on every deploy, after migrations)
|  - new key              -> created with the code defaults (label, description, sensitivity)
|  - existing key         -> only CODE-owned columns are updated (module, scopes, personas, requiresFeature)
|  - realm changed        -> conflict, NOT applied (a key must never move between realms)
|  - label, description, isSensitive, isDeprecated, sortOrder -> never overwritten (platform-owned)
|  - key in DB, not in code -> reported as orphaned, never deleted (roles may still reference it)
|--------------------------------------------------------------------------
*/

export interface PermissionSyncReport {
    created: string[]; updated: string[]; unchanged: string[]; conflicts: string[]; orphaned: string[];
}

const same = (a: readonly string[], b: readonly string[]) => [...a].sort().join("|") === [...b].sort().join("|");

export async function syncPermissions(prisma: PrismaClient): Promise<PermissionSyncReport> {
    const report: PermissionSyncReport = { created: [], updated: [], unchanged: [], conflicts: [], orphaned: [] };
    const existing = new Map((await prisma.permissionDefinition.findMany()).map(r => [r.key, r]));

    for (const def of PERMISSION_REGISTRY) {
        const row = existing.get(def.key);

        if (!row) {
            await prisma.permissionDefinition.create({
                data: {
                    key: def.key, realm: def.realm, module: def.module, scopes: [...def.scopes], personas: [...def.personas],
                    requiresFeature: def.requiresFeature, introducedInVersion: def.introducedInVersion,
                    label: def.label, description: def.description, isSensitive: def.isSensitive,
                    isDeprecated: false, sortOrder: def.sortOrder,
                },
            });
            report.created.push(def.key);
            continue;
        }

        if (row.realm !== def.realm) {
            report.conflicts.push(`${def.key}: realm is ${row.realm} in the database but ${def.realm} in code`);
            continue;
        }

        const patch: Record<string, unknown> = {};
        if (row.module !== def.module)                                   patch.module = def.module;
        if (!same(row.scopes, def.scopes))                               patch.scopes = [...def.scopes];
        if (!same(row.personas, def.personas))                           patch.personas = [...def.personas];
        if ((row.requiresFeature ?? null) !== def.requiresFeature)       patch.requiresFeature = def.requiresFeature;

        if (Object.keys(patch).length === 0) report.unchanged.push(def.key);
        else { await prisma.permissionDefinition.update({ where: { key: def.key }, data: patch }); report.updated.push(def.key); }
    }

    const codeKeys = new Set(PERMISSION_REGISTRY.map(p => p.key));
    for (const row of existing.values()) if (!codeKeys.has(row.key)) report.orphaned.push(row.key);
    return report;
}
