import type { FeatureDefinitionRow, FoundationDb } from "./foundation.db";
import { FEATURE_REGISTRY } from "./features.registry";

/*
|--------------------------------------------------------------------------
| REGISTRY SYNC (features)
| Run on every deploy, after migrations.
|
|  - new key              -> created with code defaults
|  - existing CODE key    -> only code-owned columns are updated (module, meterKey, unit)
|  - kind changed in code -> reported as a conflict and NOT applied (needs a manual data migration)
|  - PLATFORM origin      -> created once, never touched again
|  - key in DB but not in code (origin CODE) -> reported as orphaned, never deleted
|--------------------------------------------------------------------------
*/

export interface SyncReport {
    created:   string[];
    updated:   string[];
    unchanged: string[];
    skipped:   string[];
    conflicts: string[];
    orphaned:  string[];
}

export async function syncFeatureDefinitions(db: FoundationDb): Promise<SyncReport> {
    const report: SyncReport = { created: [], updated: [], unchanged: [], skipped: [], conflicts: [], orphaned: [] };
    const existing = new Map((await db.featureDefinition.findMany()).map((r) => [r.key, r]));

    for (const def of FEATURE_REGISTRY) {
        const row = existing.get(def.key);

        if (!row) {
            const data: FeatureDefinitionRow = {
                key:           def.key,
                origin:        def.origin ?? "CODE",
                kind:          def.kind,
                module:        def.module,
                meterKey:      def.meterKey ?? null,
                unit:          def.unit ?? null,
                name:          def.name,
                description:   def.description ?? null,
                enforcement:   def.enforcement ?? "BLOCK",
                upsellMessage: def.upsellMessage ?? null,
                isActive:      def.isActive ?? true,
            };
            await db.featureDefinition.create({ data });
            report.created.push(def.key);
            continue;
        }

        if (row.origin === "PLATFORM" || def.origin === "PLATFORM") {
            report.skipped.push(def.key);
            continue;
        }

        if (row.kind !== def.kind) {
            report.conflicts.push(`${def.key}: kind is ${row.kind} in DB but ${def.kind} in code`);
            continue;
        }

        const patch: Partial<FeatureDefinitionRow> = {};
        if (row.module   !== def.module)               patch.module   = def.module;
        if (row.meterKey !== (def.meterKey ?? null))   patch.meterKey = def.meterKey ?? null;
        if (row.unit     !== (def.unit ?? null))       patch.unit     = def.unit ?? null;

        if (Object.keys(patch).length === 0) {
            report.unchanged.push(def.key);
        } else {
            await db.featureDefinition.update({ where: { key: def.key }, data: patch });
            report.updated.push(def.key);
        }
    }

    const codeKeys = new Set(FEATURE_REGISTRY.map((f) => f.key));
    for (const row of existing.values()) {
        if (row.origin === "CODE" && !codeKeys.has(row.key)) report.orphaned.push(row.key);
    }

    return report;
}
