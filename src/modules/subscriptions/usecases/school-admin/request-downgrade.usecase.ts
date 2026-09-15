import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { NotFoundError, BadRequestError } from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
}

export class RequestDowngradeUseCase {
    constructor(private readonly deps: Dependencies) {}

    async execute(schoolId: string, newPlanId: string) {
        const subscription = await this.deps.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!subscription) throw new NotFoundError(SubscriptionErrorMessage.NOT_FOUND);

        const currentPlan = await this.deps.planRepository.findById(subscription.planId);
        const newPlan     = await this.deps.planRepository.findById(newPlanId);
        if (!newPlan) throw new NotFoundError(SubscriptionErrorMessage.PLAN_NOT_FOUND);

        if (currentPlan && newPlan.monthlyPriceKobo >= currentPlan.monthlyPriceKobo) {
            throw new BadRequestError("Use the upgrade flow to move to an equal or higher plan.");
        }

        await this.deps.subscriptionRepository.update(subscription.id, {
            scheduledDowngradePlanId: newPlanId,
        });

        return {
            message: `You'll move to the ${newPlan.name} plan on ${subscription.currentPeriodEnd.toLocaleDateString("en-NG")}, at the end of your current billing period.`,
        };
    }
}