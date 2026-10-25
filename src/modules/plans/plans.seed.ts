import type { PrismaClient } from "../../generated/public/client";

/*
|--------------------------------------------------------------------------
| DEFAULT PLANS (first version only)
| Plans are BUSINESS DATA owned by the platform team (prices and what each plan includes are edited in the console).
| This file only provides the first set, and is run by the registry sync:
|   - a plan that does not exist yet is created with its features
|   - an existing plan with the same name but no system key (made before this module) is ADOPTED: it gets the
|     system key and, if it has no features at all, the default features. Its prices are never changed.
|   - an existing plan is never overwritten.
| `grants` values: true = switched on; number = limit; null = unlimited.
| A key whose feature definition does not exist (or is not active yet) is skipped, so the seed never advertises
| something the platform cannot deliver (multiple branches, API access and WhatsApp are not in any plan yet).
|--------------------------------------------------------------------------
*/

type Grants = Record<string, boolean | number | null>;

interface DefaultPlan {
    systemKey: string; name: string; description: string;
    monthlyPriceKobo: number; yearlyPriceKobo: number; setupFeeKobo: number; grants: Grants;
}

const FREE: Grants = {
    "students.max": 50, "staff.max": 5,
    "notifications.email": true, "modules.attendance": true, "modules.grades": true,
    "portal.guardian": true,        // parents seeing results and fees is core value on every plan
    "branches.max": 1,              // the main branch
};
const STARTER: Grants = {
    ...FREE, "students.max": 200, "staff.max": 20,
    "notifications.sms": true, "report_cards.pdf": true,
    "modules.fees": true, "fees.online_payments": true, "fees.receipts": true,
};
const STANDARD: Grants = {
    ...STARTER, "students.max": 1000, "staff.max": 100,
    "grading.custom": true, "notifications.bulk_sms": true, "reports.advanced": true, "report_cards.letterhead": true,
    "modules.expenses": true, "finance.budgets": true, "finance.reports.accountant": true,        // expenses and budgets start on Standard (change in the console)
};
const PREMIUM: Grants = {
    ...STANDARD, "students.max": null, "staff.max": null,
    "domain.custom": true, "support.priority": true, "modules.payroll": true,        // payroll starts on Premium (change in the console)
    "branches.max": 3,              // multiple branches: the headline Premium feature (change in the console; extra branches can become an add-on)
};

export const DEFAULT_PLANS: DefaultPlan[] = [
    { systemKey: "free", name: "Free", description: "Get started for free. Perfect for small schools exploring the platform.",
      monthlyPriceKobo: 0, yearlyPriceKobo: 0, setupFeeKobo: 0, grants: FREE },
    { systemKey: "starter", name: "Starter", description: "Perfect for small schools ready to go fully digital.",
      monthlyPriceKobo: 1_000_000, yearlyPriceKobo: 10_000_000, setupFeeKobo: 500_000, grants: STARTER },        // ₦10,000 / ₦100,000 yearly (2 months free) / ₦5,000 setup
    { systemKey: "standard", name: "Standard", description: "Best for most primary and secondary schools.",
      monthlyPriceKobo: 2_500_000, yearlyPriceKobo: 25_000_000, setupFeeKobo: 500_000, grants: STANDARD },       // ₦25,000 / ₦250,000 / ₦5,000
    { systemKey: "premium", name: "Premium", description: "For larger schools needing advanced features and unlimited capacity.",
      monthlyPriceKobo: 5_000_000, yearlyPriceKobo: 50_000_000, setupFeeKobo: 1_000_000, grants: PREMIUM },      // ₦50,000 / ₦500,000 / ₦10,000
];

export interface PlanSyncReport { created: string[]; adopted: string[]; kept: string[]; skippedFeatures: string[] }

export async function syncDefaultPlans(prisma: PrismaClient): Promise<PlanSyncReport> {
    const report: PlanSyncReport = { created: [], adopted: [], kept: [], skippedFeatures: [] };
    const defs = new Map((await prisma.featureDefinition.findMany({ where: { isActive: true } })).map(d => [d.key, d]));

    const entitlementRows = (planId: string, grants: Grants) => {
        const rows: { planId: string; featureKey: string; boolValue: boolean | null; limitValue: number | null; enumValue: string | null }[] = [];
        for (const [key, v] of Object.entries(grants)) {
            const def = defs.get(key);
            if (!def) { if (!report.skippedFeatures.includes(key)) report.skippedFeatures.push(key); continue; }
            if (def.kind === "BOOLEAN" && v === true) rows.push({ planId, featureKey: key, boolValue: true, limitValue: null, enumValue: null });
            else if ((def.kind === "LIMIT" || def.kind === "QUOTA") && (v === null || typeof v === "number"))
                rows.push({ planId, featureKey: key, boolValue: null, limitValue: v as number | null, enumValue: null });
        }
        return rows;
    };

    for (const p of DEFAULT_PLANS) {
        const bySystemKey = await prisma.plan.findFirst({ where: { systemKey: p.systemKey } as never });
        if (bySystemKey) { report.kept.push(p.systemKey); continue; }

        const byName = await prisma.plan.findFirst({ where: { name: p.name } });
        if (byName) {
            await prisma.plan.update({ where: { id: byName.id }, data: { systemKey: p.systemKey } as never });
            const has = await prisma.planEntitlement.count({ where: { planId: byName.id } });
            if (!has) await prisma.planEntitlement.createMany({ data: entitlementRows(byName.id, p.grants) });
            report.adopted.push(p.systemKey);
            continue;
        }

        const created = await prisma.plan.create({
            data: {
                systemKey: p.systemKey, name: p.name, description: p.description,
                monthlyPriceKobo: p.monthlyPriceKobo, yearlyPriceKobo: p.yearlyPriceKobo, setupFeeKobo: p.setupFeeKobo,
                isPublic: true, isActive: true, isCustom: false,
            } as never,
        });
        await prisma.planEntitlement.createMany({ data: entitlementRows(created.id, p.grants) });
        report.created.push(p.systemKey);
    }
    return report;
}
