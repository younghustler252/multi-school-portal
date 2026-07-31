import { Plan } from "../../../generated/public";
import { IMapper }      from "../../../infrastructure/repository/base.repository";
import { PlanEntity }   from "../domain/plan.entity";
import { PlanFeatures } from "../domain/plan-features.interface";

/*
|--------------------------------------------------------------------------
| PLAN MAPPER
|--------------------------------------------------------------------------
*/

export interface PlanResponseData {
    id:               string;
    name:             string;
    description:      string | null;
    studentLimit:     number;
    staffLimit:       number;
    features:         PlanFeatures;
    monthlyPriceKobo: number;
    yearlyPriceKobo:  number;
    setupFeeKobo:     number;
    isPublic:         boolean;
    isActive:         boolean;
    isCustom:         boolean;
    createdAt:        Date;
}

export class PlanMapper implements IMapper<Plan, PlanEntity> {

    toDomain(raw: Plan): PlanEntity {
        return {
            id:               raw.id,
            name:             raw.name,
            description:      raw.description,
            studentLimit:     raw.studentLimit,
            staffLimit:       raw.staffLimit,
            features:         raw.features as unknown as PlanFeatures,
            monthlyPriceKobo: raw.monthlyPriceKobo,
            yearlyPriceKobo:  raw.yearlyPriceKobo,
            setupFeeKobo:     raw.setupFeeKobo,
            isPublic:         raw.isPublic,
            isActive:         raw.isActive,
            isCustom:         raw.isCustom,
            createdAt:        raw.createdAt,
            updatedAt:        raw.updatedAt,
        };
    }

    toResponse(entity: PlanEntity): PlanResponseData {
        return {
            id:               entity.id,
            name:             entity.name,
            description:      entity.description,
            studentLimit:     entity.studentLimit,
            staffLimit:       entity.staffLimit,
            features:         entity.features,
            monthlyPriceKobo: entity.monthlyPriceKobo,
            yearlyPriceKobo:  entity.yearlyPriceKobo,
            setupFeeKobo:     entity.setupFeeKobo,
            isPublic:         entity.isPublic,
            isActive:         entity.isActive,
            isCustom:         entity.isCustom,
            createdAt:        entity.createdAt,
        };
    }
}