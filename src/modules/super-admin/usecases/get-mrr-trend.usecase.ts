import { ISubscriptionRepository } from "../../subscriptions/repositories/subscription.repository";

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
}

export class GetMrrTrendUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;

    constructor({ subscriptionRepository }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute(months = 6): Promise<Array<{ month: string; mrrKobo: number }>> {
        return this.subscriptionRepository.getRevenueTrend(months);
    }
}