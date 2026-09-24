import { ISubscriptionRepository } from "../../repositories/subscription.repository";

/*
|--------------------------------------------------------------------------
| GET MY BILLING HISTORY USE CASE
| Returns paginated billing history for the school's subscription
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
}

export interface BillingHistoryItem {
    id: string;
    subscriptionId: string;
    amountKobo: number;
    status: string;
    billingCycle: string;
    paystackReference: string | null;
    paidAt: Date | null;
    failureReason: string | null;
    createdAt: Date;
}

export interface BillingHistoryResponse {
    data: BillingHistoryItem[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export class GetMyBillingHistoryUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;

    constructor({
        subscriptionRepository,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute(
        schoolId: string,
        params: {
            page?: number;
            limit?: number;
        },
    ): Promise<BillingHistoryResponse> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;

        const response =
            await this.subscriptionRepository.paginateBillingHistoryBySchool(
                schoolId,
                page,
                limit,
            );


        return response;
    }

}
