import { IPlanRepository } from "../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../mappers/plan.mapper";
import { PlanEntitlementService } from "../services/plan-entitlement.service";
import { planErrors } from "../domain/plan.errors";

interface Dependencies { planRepository: IPlanRepository; planMapper: PlanMapper; planEntitlementService: PlanEntitlementService }

// PUBLIC: one plan by id. A private or custom plan answers "not found" (its price is not public information).
export class GetPublicPlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string): Promise<PlanResponseData> {
        const plan = await this.d.planRepository.findById(id);
        if (!plan || !plan.isPublic || !plan.isActive) throw planErrors.notFound();
        const views = await this.d.planEntitlementService.describe([plan.id], "public");
        return this.d.planMapper.toResponse(plan, views.get(plan.id) ?? []);
    }
}
