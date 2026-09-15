import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { NotFoundError }           from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
}

export class ChangeSchoolPlanUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository:         IPlanRepository;

    constructor({ subscriptionRepository, planRepository }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository         = planRepository;
    }

    async execute(schoolId: string, planId: string, adminId: string) {
        const subscription = await this.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!subscription) throw new NotFoundError(SubscriptionErrorMessage.NOT_FOUND);

        const plan = await this.planRepository.findById(planId);
        if (!plan) throw new NotFoundError(SubscriptionErrorMessage.PLAN_NOT_FOUND);

        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);

        return this.subscriptionRepository.update(subscription.id, {
            planId, status: "active", currentPeriodStart: now, currentPeriodEnd: end, nextBillingDate: end,
        });
    }
}