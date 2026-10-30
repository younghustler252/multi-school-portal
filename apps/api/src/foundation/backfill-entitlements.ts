import type { FoundationDb, PlanEntitlementRow } from "./foundation.db";
import { FEATURE_BY_LEGACY_FLAG, findDependencyWarnings } from "./features.registry";

/*
|--------------------------------------------------------------------------
| BACKFILL: Plan.features JSON + Plan.studentLimit/staffLimit -> PlanEntitlement
| One-time, idempotent. Run AFTER syncFeatureDefinitions().
|
|  - a legacy flag that is exactly `true` becomes a boolean entitlement row
|  - false or missing flag -> no row (no row = not granted)
|  - studentLimit / staffLimit become students.max / staff.max; -1 -> limitValue null (unlimited)
|  - rows that already exist are never overwritten, so console edits survive a re-run
|  - unknown legacy flags and dependency problems are reported, not fatal
|--------------------------------------------------------------------------
*/

export interface PlanBackfillReport {
    planId:       string;
    planName:     string;
    created:      string[];
    alreadyThere: string[];
    unmappedFlags: string[];
    warnings:     string[];
}

export async function backfillEntitlements(
    db: FoundationDb,
    opts: { dryRun?: boolean } = {},
): Promise<PlanBackfillReport[]> {
    const reports: PlanBackfillReport[] = [];
    const plans = await db.plan.findMany();

    for (const plan of plans) {
        const report: PlanBackfillReport = {
            planId: plan.id, planName: plan.name,
            created: [], alreadyThere: [], unmappedFlags: [], warnings: [],
        };

        const existing = new Set((await db.planEntitlement.findMany({ where: { planId: plan.id } })).map((r) => r.featureKey));
        const desired: PlanEntitlementRow[] = [];

        const flags = (plan.features && typeof plan.features === "object" ? plan.features : {}) as Record<string, unknown>;
        const grantedBooleans = new Set<string>();

        for (const [flag, value] of Object.entries(flags)) {
            const def = FEATURE_BY_LEGACY_FLAG.get(flag);
            if (!def) { report.unmappedFlags.push(flag); continue; }
            if (value === true) {
                grantedBooleans.add(def.key);
                desired.push({ planId: plan.id, featureKey: def.key, boolValue: true, limitValue: null, enumValue: null });
            }
        }

        const limit = (n: number): number | null => (n === -1 ? null : n);
        desired.push({ planId: plan.id, featureKey: "students.max", boolValue: null, limitValue: limit(plan.studentLimit), enumValue: null });
        desired.push({ planId: plan.id, featureKey: "staff.max",    boolValue: null, limitValue: limit(plan.staffLimit),   enumValue: null });

        report.warnings.push(...findDependencyWarnings(grantedBooleans));

        for (const row of desired) {
            if (existing.has(row.featureKey)) { report.alreadyThere.push(row.featureKey); continue; }
            if (!opts.dryRun) await db.planEntitlement.create({ data: row });
            report.created.push(row.featureKey);
        }

        reports.push(report);
    }

    return reports;
}
