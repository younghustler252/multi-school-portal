import { ISubscriptionRepository }  from "../../repository/subscription.repository";
import { IPlanRepository }          from "../../../plans/repositories/plan.repository";
import { SubscriptionMapper }       from "../../mappers/subscription.mapper";
import { SubscriptionResponseData } from "../../mappers/subscription.mapper";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";
import { UpgradePlanDtoType }       from "../../dtos/subscription.dto";

/*
|--------------------------------------------------------------------------
| UPGRADE PLAN USE CASE
| School admin upgrades to a higher plan
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
    subscriptionMapper:     SubscriptionMapper;
}

export class UpgradePlanUseCase {
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

    async execute(
        schoolId: string,
        dto:      UpgradePlanDtoType,
    ): Promise<SubscriptionResponseData> {

        // ── Find active subscription ──────────────────────────────────────
        const subscription = await this.subscriptionRepository
            .findActiveBySchoolId(schoolId);

        if (!subscription) {
            throw new NotFoundError(SubscriptionErrorMessage.NOT_FOUND);
        }

        // ── Find new plan ─────────────────────────────────────────────────
        const newPlan = await this.planRepository.findById(dto.planId);
        if (!newPlan) {
            throw new NotFoundError(SubscriptionErrorMessage.PLAN_NOT_FOUND);
        }

        // ── Calculate new period ──────────────────────────────────────────
        const now   = new Date();
        const end   = new Date(now);

        if (dto.billingCycle === "yearly") {
            end.setFullYear(end.getFullYear() + 1);
        } else {
            end.setMonth(end.getMonth() + 1);
        }

        // ── Update subscription ───────────────────────────────────────────
        const updated = await this.subscriptionRepository.update(
            subscription.id,
            {
                planId:             dto.planId,
                billingCycle:       dto.billingCycle,
                status:             "active",
                currentPeriodStart: now,
                currentPeriodEnd:   end,
                nextBillingDate:    end,
            },
        );

        return this.subscriptionMapper.toResponse(updated);
    }
}