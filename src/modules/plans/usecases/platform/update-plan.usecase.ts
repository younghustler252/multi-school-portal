import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";
import { AuditService } from "../../../audit/services/audit.service";
import { assertPrices } from "../../domain/plan.policy";
import { planErrors } from "../../domain/plan.errors";
import { UpdatePlanDtoType } from "../../dtos/plan.dto";

interface Dependencies {
    planRepository: IPlanRepository; planMapper: PlanMapper;
    planEntitlementService: PlanEntitlementService; auditService: AuditService;
}

/*
| UPDATE PLAN (name, description, prices, visibility; what the plan includes has its own endpoint).
| The built-in Free plan keeps price 0 and stays public. A price change returns `subscribersAffected` so the
| person editing knows how many schools it touches (renewals use the plan's CURRENT price).
*/
export class UpdatePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, actorUserId: string, dto: UpdatePlanDtoType): Promise<PlanResponseData & { subscribersAffected: number }> {
        const d = this.d;
        const plan = await d.planRepository.findById(id);
        if (!plan) throw planErrors.notFound();
        const isFree = plan.systemKey === "free";

        if (dto.name && dto.name !== plan.name && await d.planRepository.findByName(dto.name)) throw planErrors.nameTaken();

        const monthly = dto.monthlyPriceKobo ?? plan.monthlyPriceKobo;
        const yearly  = dto.yearlyPriceKobo  ?? plan.yearlyPriceKobo;
        const setup   = dto.setupFeeKobo     ?? plan.setupFeeKobo;
        if (isFree && (monthly !== 0 || yearly !== 0 || setup !== 0)) throw planErrors.systemProtected("given a price");
        if (isFree && dto.isPublic === false) throw planErrors.systemProtected("hidden");
        assertPrices(monthly, yearly);

        const before: Record<string, unknown> = {};
        const after:  Record<string, unknown> = {};
        for (const [k, v] of Object.entries(dto)) {
            const cur = (plan as unknown as Record<string, unknown>)[k];
            if (v !== undefined && v !== cur) { before[k] = cur; after[k] = v; }
        }

        const updated = Object.keys(after).length ? await d.planRepository.update(id, after) : plan;
        const priceChanged = ["monthlyPriceKobo", "yearlyPriceKobo", "setupFeeKobo"].some(k => k in after);
        const subscribersAffected = priceChanged ? await d.planEntitlementService.countSubscribers(id) : 0;

        if (Object.keys(after).length) {
            await d.auditService.log({
                userId: actorUserId, action: "plan.updated", entity: "Plan", entityId: id,
                oldValue: before, newValue: after, metadata: { subscribersAffected },
            });
        }
        const views = await d.planEntitlementService.describe([id], "platform");
        return { ...d.planMapper.toResponse(updated, views.get(id) ?? []), subscribersAffected };
    }
}
