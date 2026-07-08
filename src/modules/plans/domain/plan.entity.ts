import { PlanFeatures } from "./plan-features.interface";

/*
|--------------------------------------------------------------------------
| PLAN DOMAIN ENTITY
|--------------------------------------------------------------------------
*/

export interface PlanEntity {
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
    updatedAt:        Date;
}