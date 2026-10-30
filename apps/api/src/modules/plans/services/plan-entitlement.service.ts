import { Prisma, PrismaClient } from "../../../generated/public";
import { PlanEntitlementView } from "../domain/plan.entity";
import { EntitlementInput } from "../dtos/plan.dto";
import { planErrors } from "../domain/plan.errors";

interface Dependencies { prismaClient: PrismaClient }

export interface NormalizedEntitlements {
    upserts: { featureKey: string; boolValue: boolean | null; limitValue: number | null; enumValue: string | null }[];
    removes: string[];
}

/*
|--------------------------------------------------------------------------
| PLAN ENTITLEMENT SERVICE: what a plan includes.
| Rules (same as the entitlements service that enforces them):
|   no row = not granted (BOOLEAN false, LIMIT / QUOTA 0)
|   a LIMIT / QUOTA row with a null limitValue = unlimited
|--------------------------------------------------------------------------
*/
export class PlanEntitlementService {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: Dependencies) { this.prisma = prismaClient; }

    /**
     * mode "public":   only active features the plan grants (a pricing page)
     * mode "platform": every feature with its current value (the console matrix)
     */
    async describe(planIds: string[], mode: "public" | "platform"): Promise<Map<string, PlanEntitlementView[]>> {
        const [defs, rows] = await Promise.all([
            this.prisma.featureDefinition.findMany({ where: mode === "public" ? { isActive: true } : {}, orderBy: [{ module: "asc" }, { key: "asc" }] }),
            this.prisma.planEntitlement.findMany({ where: { planId: { in: planIds } } }),
        ]);

        const out = new Map<string, PlanEntitlementView[]>();
        for (const planId of planIds) {
            const mine = new Map(rows.filter(r => r.planId === planId).map(r => [r.featureKey, r]));
            const views: PlanEntitlementView[] = [];
            for (const d of defs) {
                const r = mine.get(d.key);
                let granted = false; let value: PlanEntitlementView["value"] = null; let unlimited = false;

                if (d.kind === "BOOLEAN")      { granted = r?.boolValue === true; value = granted; }
                else if (d.kind === "ENUM")    { granted = !!r?.enumValue; value = r?.enumValue ?? null; }
                else /* LIMIT | QUOTA */       { granted = !!r; unlimited = !!r && r.limitValue === null; value = r ? r.limitValue : 0; }

                if (mode === "public" && !granted) continue;
                views.push({
                    key: d.key, name: d.name, description: d.description, module: d.module, kind: d.kind as PlanEntitlementView["kind"],
                    unit: d.unit, isActive: d.isActive, granted, value, unlimited,
                });
            }
            out.set(planId, views);
        }
        return out;
    }

    /** Checks every line against the feature's kind. Unknown keys and mismatched values are rejected. */
    async normalize(items: EntitlementInput[]): Promise<NormalizedEntitlements> {
        const seen = new Set<string>();
        const defs = new Map((await this.prisma.featureDefinition.findMany({ where: { key: { in: items.map(i => i.featureKey) } } })).map(d => [d.key, d]));
        const result: NormalizedEntitlements = { upserts: [], removes: [] };

        for (const item of items) {
            const def = defs.get(item.featureKey);
            if (!def) throw planErrors.unknownFeature(item.featureKey);
            if (seen.has(item.featureKey)) throw planErrors.badEntitlement(item.featureKey, "listed more than once");
            seen.add(item.featureKey);

            if (item.remove) { result.removes.push(item.featureKey); continue; }

            if (def.kind === "BOOLEAN") {
                if (item.boolValue === undefined || item.limitValue !== undefined || item.enumValue !== undefined)
                    throw planErrors.badEntitlement(item.featureKey, "this is an on/off feature: send boolValue only");
                result.upserts.push({ featureKey: item.featureKey, boolValue: item.boolValue, limitValue: null, enumValue: null });
            } else if (def.kind === "LIMIT" || def.kind === "QUOTA") {
                if (item.limitValue === undefined || item.boolValue !== undefined || item.enumValue !== undefined)
                    throw planErrors.badEntitlement(item.featureKey, "this is a numeric limit: send limitValue only (null means unlimited)");
                result.upserts.push({ featureKey: item.featureKey, boolValue: null, limitValue: item.limitValue, enumValue: null });
            } else {
                if (item.enumValue === undefined || item.boolValue !== undefined || item.limitValue !== undefined)
                    throw planErrors.badEntitlement(item.featureKey, "this is a choice feature: send enumValue only");
                result.upserts.push({ featureKey: item.featureKey, boolValue: null, limitValue: null, enumValue: item.enumValue });
            }
        }
        return result;
    }

    async apply(planId: string, n: NormalizedEntitlements): Promise<void> {
        await this.prisma.$transaction([
            ...n.upserts.map(u => this.prisma.planEntitlement.upsert({
                where:  { planId_featureKey: { planId, featureKey: u.featureKey } },
                update: { boolValue: u.boolValue, limitValue: u.limitValue, enumValue: u.enumValue },
                create: { planId, featureKey: u.featureKey, boolValue: u.boolValue, limitValue: u.limitValue, enumValue: u.enumValue },
            })),
            ...(n.removes.length ? [this.prisma.planEntitlement.deleteMany({ where: { planId, featureKey: { in: n.removes } } })] : []),
        ]);
    }

    async copy(fromPlanId: string, toPlanId: string): Promise<number> {
        const rows = await this.prisma.planEntitlement.findMany({ where: { planId: fromPlanId } });
        if (!rows.length) return 0;
        await this.prisma.planEntitlement.createMany({
            data: rows.map(r => ({ planId: toPlanId, featureKey: r.featureKey, boolValue: r.boolValue, limitValue: r.limitValue, enumValue: r.enumValue })) as Prisma.PlanEntitlementCreateManyInput[],
        });
        return rows.length;
    }

    async subscriberCounts(planIds: string[]): Promise<Map<string, number>> {
        const groups = await this.prisma.subscription.groupBy({
            by: ["planId"], where: { planId: { in: planIds }, status: { in: ["trialing", "active", "past_due"] } }, _count: { _all: true },
        });
        return new Map(groups.map(g => [g.planId, g._count._all]));
    }

    async countSubscribers(planId: string): Promise<number> {
        return this.prisma.subscription.count({ where: { planId, status: { in: ["trialing", "active", "past_due"] } } });
    }
}
