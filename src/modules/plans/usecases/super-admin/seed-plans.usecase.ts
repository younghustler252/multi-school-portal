import { IPlanRepository }  from "../../repositories/plan.repository";
import { PlanMapper }       from "../../mappers/plan.mapper";
import { PlanResponseData } from "../../mappers/plan.mapper";
import {
    FREE_FEATURES,
    STARTER_FEATURES,
    STANDARD_FEATURES,
    PREMIUM_FEATURES,
}                           from "../../domain/plan-features.interface";
import { PlanName }         from "../../domain/plan.enums";

/*
|--------------------------------------------------------------------------
| SEED PLANS USE CASE
| Super admin seeds default plans on platform setup
| Safe to run multiple times — skips existing plans
|--------------------------------------------------------------------------
*/

interface Dependencies {
    planRepository: IPlanRepository;
    planMapper:     PlanMapper;
}

export class SeedPlansUseCase {
    private readonly planRepository: IPlanRepository;
    private readonly planMapper:     PlanMapper;

    constructor({ planRepository, planMapper }: Dependencies) {
        this.planRepository = planRepository;
        this.planMapper     = planMapper;
    }

    async execute(): Promise<PlanResponseData[]> {
        const defaultPlans = [
            {
                name:             PlanName.FREE,
                description:      "Get started for free. Perfect for small schools exploring the platform.",
                studentLimit:     50,
                staffLimit:       5,
                features:         FREE_FEATURES,
                monthlyPriceKobo: 0,
                yearlyPriceKobo:  0,
                setupFeeKobo:     0,
                isPublic:         true,
                isCustom:         false,
            },
            {
                name:             PlanName.STARTER,
                description:      "Perfect for small schools ready to go fully digital.",
                studentLimit:     200,
                staffLimit:       20,
                features:         STARTER_FEATURES,
                monthlyPriceKobo: 1000000,   // ₦10,000
                yearlyPriceKobo:  10000000,  // ₦100,000 (2 months free)
                setupFeeKobo:     500000,    // ₦5,000 one-time
                isPublic:         true,
                isCustom:         false,
            },
            {
                name:             PlanName.STANDARD,
                description:      "Best for most primary and secondary schools.",
                studentLimit:     1000,
                staffLimit:       100,
                features:         STANDARD_FEATURES,
                monthlyPriceKobo: 2500000,   // ₦25,000
                yearlyPriceKobo:  25000000,  // ₦250,000 (2 months free)
                setupFeeKobo:     500000,    // ₦5,000 one-time
                isPublic:         true,
                isCustom:         false,
            },
            {
                name:             PlanName.PREMIUM,
                description:      "For larger schools needing advanced features and unlimited capacity.",
                studentLimit:     -1,
                staffLimit:       -1,
                features:         PREMIUM_FEATURES,
                monthlyPriceKobo: 5000000,   // ₦50,000
                yearlyPriceKobo:  50000000,  // ₦500,000 (2 months free)
                setupFeeKobo:     1000000,   // ₦10,000 one-time
                isPublic:         true,
                isCustom:         false,
            },
        ];

        const results: PlanResponseData[] = [];

        for (const planData of defaultPlans) {
            // Skip if already exists
            const existing = await this.planRepository.findByName(planData.name);
            if (existing) {
                results.push(this.planMapper.toResponse(existing));
                continue;
            }

            const plan = await this.planRepository.create(planData);
            results.push(this.planMapper.toResponse(plan));
        }

        return results;
    }
}