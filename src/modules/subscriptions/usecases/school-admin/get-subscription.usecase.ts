import { ISubscriptionRepository }  from "../../repository/subscription.repository";
import { IPlanRepository }          from "../../../plans/repositories/plan.repository";
import { SubscriptionMapper }       from "../../mappers/subscription.mapper";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";

/*
|--------------------------------------------------------------------------
| GET SUBSCRIPTION USE CASE
| Returns school's active subscription with plan details
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
    subscriptionMapper:     SubscriptionMapper;
}

export interface SubscriptionWithPlan {
    subscription: any;
    plan:         any;
}

export class GetSubscriptionUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository:         IPlanRepository;
    private readonly subscriptionMapper:     SubscriptionMapper;

    constructor({
        subscriptionRepository,
        planRepository,
        subscriptionMapper,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository         = planRepository;
        this.subscriptionMapper     = subscriptionMapper;
    }

    async execute(schoolId: string): Promise<SubscriptionWithPlan> {

        // ── Find active subscription ──────────────────────────────────────
        const subscription = await this.subscriptionRepository
            .findActiveBySchoolId(schoolId);

        if (!subscription) {
            throw new NotFoundError(SubscriptionErrorMessage.NOT_FOUND);
        }

        // ── Find plan details ─────────────────────────────────────────────
        const plan = await this.planRepository.findById(subscription.planId);

        if (!plan) {
            throw new NotFoundError(SubscriptionErrorMessage.PLAN_NOT_FOUND);
        }

        return {
            subscription: this.subscriptionMapper.toResponse(subscription),
            plan,
        };
    }
}