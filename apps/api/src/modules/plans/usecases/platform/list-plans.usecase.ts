import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";

interface Dependencies { planRepository: IPlanRepository; planMapper: PlanMapper; planEntitlementService: PlanEntitlementService }

// PLATFORM: every plan (private, custom and retired included) with how many schools use it.
// The feature matrix is on the single-plan view, not here.
export class ListPlansUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(): Promise<(PlanResponseData & { subscribers: number })[]> {
        const plans  = await this.d.planRepository.listAll();
        const counts = await this.d.planEntitlementService.subscriberCounts(plans.map(p => p.id));
        return plans.map(p => ({ ...this.d.planMapper.toResponse(p), subscribers: counts.get(p.id) ?? 0 }));
    }
}
