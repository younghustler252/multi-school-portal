import { IPlanRepository } from "../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../mappers/plan.mapper";
import { PlanEntitlementService } from "../services/plan-entitlement.service";

interface Dependencies { planRepository: IPlanRepository; planMapper: PlanMapper; planEntitlementService: PlanEntitlementService }

// PUBLIC (pricing page): public and active plans only, each with the features it includes. No login needed.
export class GetPublicPlansUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(): Promise<PlanResponseData[]> {
        const plans = await this.d.planRepository.findPublicPlans();
        const views = await this.d.planEntitlementService.describe(plans.map(p => p.id), "public");
        return plans.map(p => this.d.planMapper.toResponse(p, views.get(p.id) ?? []));
    }
}
