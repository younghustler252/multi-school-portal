import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";
import { planErrors } from "../../domain/plan.errors";

interface Dependencies { planRepository: IPlanRepository; planMapper: PlanMapper; planEntitlementService: PlanEntitlementService }

// PLATFORM: one plan with the FULL feature matrix (every feature, granted or not) for the console
export class GetPlatformPlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string): Promise<PlanResponseData & { subscribers: number }> {
        const plan = await this.d.planRepository.findById(id);
        if (!plan) throw planErrors.notFound();
        const [views, subscribers] = await Promise.all([
            this.d.planEntitlementService.describe([plan.id], "platform"),
            this.d.planEntitlementService.countSubscribers(plan.id),
        ]);
        return { ...this.d.planMapper.toResponse(plan, views.get(plan.id) ?? []), subscribers };
    }
}
