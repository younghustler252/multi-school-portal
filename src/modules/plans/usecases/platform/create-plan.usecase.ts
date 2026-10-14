import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";
import { AuditService } from "../../../audit/services/audit.service";
import { assertPrices } from "../../domain/plan.policy";
import { planErrors } from "../../domain/plan.errors";
import { CreatePlanDtoType } from "../../dtos/plan.dto";

interface Dependencies {
    planRepository: IPlanRepository; planMapper: PlanMapper;
    planEntitlementService: PlanEntitlementService; auditService: AuditService;
}

export class CreatePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: CreatePlanDtoType, actorUserId: string): Promise<PlanResponseData> {
        const d = this.d;
        assertPrices(dto.monthlyPriceKobo, dto.yearlyPriceKobo);
        if (await d.planRepository.findByName(dto.name)) throw planErrors.nameTaken();

        // Validate the features BEFORE creating anything, so a bad line never leaves a half-made plan
        const normalized = dto.entitlements ? await d.planEntitlementService.normalize(dto.entitlements) : null;

        const plan = await d.planRepository.create({
            name: dto.name, description: dto.description ?? null,
            monthlyPriceKobo: dto.monthlyPriceKobo, yearlyPriceKobo: dto.yearlyPriceKobo, setupFeeKobo: dto.setupFeeKobo ?? 0,
            isPublic: dto.isPublic ?? true, isCustom: dto.isCustom ?? false, isActive: true,
        });
        if (normalized) await d.planEntitlementService.apply(plan.id, normalized);

        await d.auditService.log({
            userId: actorUserId, action: "plan.created", entity: "Plan", entityId: plan.id,
            newValue: { name: plan.name, monthlyPriceKobo: plan.monthlyPriceKobo, yearlyPriceKobo: plan.yearlyPriceKobo, isPublic: plan.isPublic, isCustom: plan.isCustom },
        });
        const views = await d.planEntitlementService.describe([plan.id], "platform");
        return d.planMapper.toResponse(plan, views.get(plan.id) ?? []);
    }
}
