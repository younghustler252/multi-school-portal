import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
}

export class GetSubscriptionStatsUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository:         IPlanRepository;

    constructor({
        subscriptionRepository,
        planRepository,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository         = planRepository;
    }

    async execute() {
        const freePlan = await this.planRepository.findFreePlan();

        const [active, trialing, pastDue, expired, onFree] = await Promise.all([
            this.subscriptionRepository.count({ status: "active" }),
            this.subscriptionRepository.count({ status: "trialing" }),
            this.subscriptionRepository.count({ status: "past_due" }),
            this.subscriptionRepository.count({ status: "expired" }),
            freePlan ? this.subscriptionRepository.count({ planId: freePlan.id }) : 0,
        ]);

        return {
            active,
            trialing,
            pastDue,
            expired,
            onFreePlan: onFree,
        };
    }
}
