import { IPlanRepository }  from "../../repositories/plan.repository";
import { PlanMapper }       from "../../mappers/plan.mapper";
import { PlanResponseData } from "../../mappers/plan.mapper";
import {
    NotFoundError,
    BadRequestError,
}                           from "../../../../shared/errors/domain.errors";
import { PlanErrorMessage } from "../../domain/plan.enums";

/*
|--------------------------------------------------------------------------
| DELETE PLAN USE CASE
| Super admin soft-deletes a plan
| Cannot delete if schools are actively subscribed to it
|--------------------------------------------------------------------------
*/

interface Dependencies {
    planRepository:         IPlanRepository;
    planMapper:             PlanMapper;
    subscriptionRepository: any; // avoid circular — use any, check count via raw
}

export class DeletePlanUseCase {
    private readonly planRepository:         IPlanRepository;
    private readonly planMapper:             PlanMapper;
    private readonly subscriptionRepository: any;

    constructor({
        planRepository,
        planMapper,
        subscriptionRepository,
    }: Dependencies) {
        this.planRepository         = planRepository;
        this.planMapper             = planMapper;
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute(id: string): Promise<PlanResponseData> {

        // ── Find plan ─────────────────────────────────────────────────────
        const plan = await this.planRepository.findById(id);
        if (!plan) {
            throw new NotFoundError(PlanErrorMessage.NOT_FOUND);
        }

        // ── Check no active subscriptions ─────────────────────────────────
        const activeCount = await this.subscriptionRepository.count({
            planId: id,
            status: { in: ["active", "trialing"] },
        });

        if (activeCount > 0) {
            throw new BadRequestError(
                `Cannot delete this plan — ${activeCount} school(s) are actively subscribed to it.`,
            );
        }

        // ── Soft delete — set isActive: false ─────────────────────────────
        const deleted = await this.planRepository.update(id, {
            isActive: false,
        });

        return this.planMapper.toResponse(deleted);
    }
}