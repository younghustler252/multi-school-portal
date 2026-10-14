import { IPlanRepository } from "../../repositories/plan.repository";
import { PlanMapper, PlanResponseData } from "../../mappers/plan.mapper";
import { PlanEntitlementService } from "../../services/plan-entitlement.service";
import { AuditService } from "../../../audit/services/audit.service";
import { planErrors } from "../../domain/plan.errors";

interface Dependencies {
    planRepository: IPlanRepository; planMapper: PlanMapper;
    planEntitlementService: PlanEntitlementService; auditService: AuditService;
}

/*
| RETIRE / RESTORE A PLAN. A retired plan (isActive = false) cannot be chosen by anyone new.
| It cannot be retired while schools still use it (move them first), and the built-in Free plan never retires:
| registration depends on it. Plans are never hard-deleted (billing history points at them).
*/
export class DeactivatePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, actorUserId: string): Promise<PlanResponseData> {
        const d = this.d;
        const plan = await d.planRepository.findById(id);
        if (!plan) throw planErrors.notFound();
        if (plan.systemKey === "free") throw planErrors.systemProtected("deactivated");
        if (!plan.isActive) return d.planMapper.toResponse(plan);

        const subscribers = await d.planEntitlementService.countSubscribers(id);
        if (subscribers > 0) throw planErrors.hasSubscribers(subscribers);

        const updated = await d.planRepository.update(id, { isActive: false });
        await d.auditService.log({ userId: actorUserId, action: "plan.deactivated", entity: "Plan", entityId: id });
        return d.planMapper.toResponse(updated);
    }
}

export class ReactivatePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, actorUserId: string): Promise<PlanResponseData> {
        const d = this.d;
        const plan = await d.planRepository.findById(id);
        if (!plan) throw planErrors.notFound();
        if (plan.isActive) return d.planMapper.toResponse(plan);
        const updated = await d.planRepository.update(id, { isActive: true });
        await d.auditService.log({ userId: actorUserId, action: "plan.reactivated", entity: "Plan", entityId: id });
        return d.planMapper.toResponse(updated);
    }
}
