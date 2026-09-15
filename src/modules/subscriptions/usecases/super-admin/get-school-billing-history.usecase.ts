import { ISubscriptionRepository } from "../../repositories/subscription.repository";

interface Dependencies { subscriptionRepository: ISubscriptionRepository; }

export class GetSchoolBillingHistoryUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    constructor({ subscriptionRepository }: Dependencies) { this.subscriptionRepository = subscriptionRepository; }

    async execute(schoolId: string, params: { page?: number; limit?: number }) {
        return this.subscriptionRepository.paginateBillingHistoryBySchool(schoolId, params.page ?? 1, params.limit ?? 20);
    }
}