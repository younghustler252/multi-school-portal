import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";
import { AuditService } from "../../../audit/services/audit.service";
import { planErrors } from "../../domain/plan.errors";
import { SetEntitlementsDtoType } from "../../dtos/plan.dto";

interface Dependencies {
    planRepository: IPlanRepository; planMapper: PlanMapper;
    planEntitlementService: PlanEntitlementService; auditService: AuditService;
}

/*
| SET WHAT A PLAN INCLUDES. Only the lines sent are changed; every other feature stays as it is.
| All lines are validated first and applied in one transaction (all or nothing).
| Schools see the change within the entitlements cache window (30 seconds).
*/
export class SetPlanEntitlementsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, actorUserId: string, dto: SetEntitlementsDtoType): Promise<PlanResponseData & { subscribers: number }> {
        const d = this.d;
        const plan = await d.planRepository.findById(id);
        if (!plan) throw planErrors.notFound();

        const before = (await d.planEntitlementService.describe([id], "platform")).get(id) ?? [];
        const normalized = await d.planEntitlementService.normalize(dto.entitlements);
        await d.planEntitlementService.apply(id, normalized);
        const after = (await d.planEntitlementService.describe([id], "platform")).get(id) ?? [];

        // Audit only what actually changed
        const prev = new Map(before.map(v => [v.key, `${v.granted}:${String(v.value)}`]));
        const changed = after.filter(v => prev.get(v.key) !== `${v.granted}:${String(v.value)}`)
                             .map(v => ({ key: v.key, granted: v.granted, value: v.value }));
        if (changed.length) {
            await d.auditService.log({
                userId: actorUserId, action: "plan.entitlements_changed", entity: "Plan", entityId: id,
                newValue: { changed }, metadata: { planName: plan.name },
            });
        }
        const subscribers = await d.planEntitlementService.countSubscribers(id);
        return { ...d.planMapper.toResponse(plan, after), subscribers };
    }
}
