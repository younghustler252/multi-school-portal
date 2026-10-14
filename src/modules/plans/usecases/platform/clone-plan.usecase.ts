import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";
import { AuditService } from "../../../audit/services/audit.service";
import { planErrors } from "../../domain/plan.errors";
import { ClonePlanDtoType } from "../../dtos/plan.dto";

interface Dependencies {
    planRepository: IPlanRepository; planMapper: PlanMapper;
    planEntitlementService: PlanEntitlementService; auditService: AuditService;
}

// Starting point for a custom plan (for example an enterprise school): same prices and features, new name, private by default
export class ClonePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, actorUserId: string, dto: ClonePlanDtoType): Promise<PlanResponseData> {
        const d = this.d;
        const source = await d.planRepository.findById(id);
        if (!source) throw planErrors.notFound();
        if (await d.planRepository.findByName(dto.name)) throw planErrors.nameTaken();

        const plan = await d.planRepository.create({
            name: dto.name, description: source.description,
            monthlyPriceKobo: source.monthlyPriceKobo, yearlyPriceKobo: source.yearlyPriceKobo, setupFeeKobo: source.setupFeeKobo,
            isPublic: dto.isPublic, isCustom: true, isActive: true,     // never inherits the system key
        });
        const copied = await d.planEntitlementService.copy(source.id, plan.id);

        await d.auditService.log({
            userId: actorUserId, action: "plan.cloned", entity: "Plan", entityId: plan.id,
            metadata: { from: source.id, fromName: source.name, entitlementsCopied: copied },
        });
        const views = await d.planEntitlementService.describe([plan.id], "platform");
        return d.planMapper.toResponse(plan, views.get(plan.id) ?? []);
    }
}
