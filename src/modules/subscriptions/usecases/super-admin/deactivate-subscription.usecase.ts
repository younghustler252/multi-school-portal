import { ISubscriptionRepository }  from "../../repositories/subscription.repository";
import { SubscriptionMapper }       from "../../mappers/subscription.mapper";
import { SubscriptionResponseData } from "../../mappers/subscription.mapper";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";

/*
|--------------------------------------------------------------------------
| DEACTIVATE SUBSCRIPTION USE CASE
| Super admin force-deactivates a school subscription
| Used for: payment issues, policy violations, manual intervention
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    subscriptionMapper:     SubscriptionMapper;
}

export class DeactivateSubscriptionUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly subscriptionMapper:     SubscriptionMapper;

    constructor({
        subscriptionRepository,
        subscriptionMapper,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionMapper     = subscriptionMapper;
    }

    async execute(subscriptionId: string): Promise<SubscriptionResponseData> {
        const subscription = await this.subscriptionRepository
            .findById(subscriptionId);

        if (!subscription) {
            throw new NotFoundError(SubscriptionErrorMessage.NOT_FOUND);
        }

        const updated = await this.subscriptionRepository.update(
            subscriptionId,
            {
                status:      "suspended",
                cancelledAt: new Date(),
            },
        );

        return this.subscriptionMapper.toResponse(updated);
    }
}