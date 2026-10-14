import { Plan } from "../../../generated/public";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { PlanEntity, PlanEntitlementView } from "../domain/plan.entity";

export interface PlanResponseData {
    id:                   string;
    name:                 string;
    description:          string | null;
    monthlyPriceKobo:     number;
    yearlyPriceKobo:      number;
    yearlySavingsPercent: number;        // how much cheaper yearly is than 12 months (0 when it is not)
    setupFeeKobo:         number;
    isPublic:             boolean;
    isActive:             boolean;
    isCustom:             boolean;
    isFree:               boolean;
    entitlements:         PlanEntitlementView[];
    createdAt:            Date;
}

export class PlanMapper implements IMapper<Plan, PlanEntity> {

    toDomain(raw: Plan): PlanEntity {
        const r = raw as unknown as Plan & { systemKey?: string | null };
        return {
            id: r.id, systemKey: r.systemKey ?? null, name: r.name, description: r.description,
            monthlyPriceKobo: r.monthlyPriceKobo, yearlyPriceKobo: r.yearlyPriceKobo, setupFeeKobo: r.setupFeeKobo,
            isPublic: r.isPublic, isActive: r.isActive, isCustom: r.isCustom, createdAt: r.createdAt, updatedAt: r.updatedAt,
        };
    }

    toResponse(e: PlanEntity, entitlements: PlanEntitlementView[] = []): PlanResponseData {
        const yearlyFull = e.monthlyPriceKobo * 12;
        return {
            id: e.id, name: e.name, description: e.description,
            monthlyPriceKobo: e.monthlyPriceKobo, yearlyPriceKobo: e.yearlyPriceKobo,
            yearlySavingsPercent: yearlyFull > 0 && e.yearlyPriceKobo < yearlyFull
                ? Math.round((1 - e.yearlyPriceKobo / yearlyFull) * 100) : 0,
            setupFeeKobo: e.setupFeeKobo, isPublic: e.isPublic, isActive: e.isActive, isCustom: e.isCustom,
            isFree: e.systemKey === "free", entitlements, createdAt: e.createdAt,
        };
    }
}
