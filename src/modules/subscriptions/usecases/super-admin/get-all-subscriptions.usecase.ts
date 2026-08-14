import { ISubscriptionRepository }  from "../../repositories/subscription.repository";
import { SubscriptionMapper }       from "../../mappers/subscription.mapper";
import { SubscriptionResponseData } from "../../mappers/subscription.mapper";
import { PaginatedResult }          from "../../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| GET ALL SUBSCRIPTIONS USE CASE
| Super admin views all subscriptions with filters
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    subscriptionMapper:     SubscriptionMapper;
}

export class GetAllSubscriptionsUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly subscriptionMapper:     SubscriptionMapper;

    constructor({
        subscriptionRepository,
        subscriptionMapper,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionMapper     = subscriptionMapper;
    }

    async execute(params: {
        page?:   number;
        limit?:  number;
        status?: string;
        planId?: string;
    }): Promise<PaginatedResult<SubscriptionResponseData>> {

        const where: Record<string, any> = {};

        if (params.status) where.status = params.status;
        if (params.planId) where.planId = params.planId;

        const result = await this.subscriptionRepository.paginate({
            page:    params.page,
            limit:   params.limit,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(s =>
                this.subscriptionMapper.toResponse(s),
            ),
            meta: result.meta,
        };
    }
}