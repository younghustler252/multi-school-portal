import { ISubscriptionRepository }  from "../../repositories/subscription.repository";
import { SubscriptionMapper }       from "../../mappers/subscription.mapper";
import { SubscriptionResponseData } from "../../mappers/subscription.mapper";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";
import { CancelSubscriptionDtoType } from "../../dtos/subscription.dto";

/*
|--------------------------------------------------------------------------
| CANCEL SUBSCRIPTION USE CASE
| School cancels — stays active until period end by default
|--------------------------------------------------------------------------
*/

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
    subscriptionMapper:     SubscriptionMapper;
}

export class CancelSubscriptionUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly subscriptionMapper:     SubscriptionMapper;

    constructor({
        subscriptionRepository,
        subscriptionMapper,
    }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionMapper     = subscriptionMapper;
    }

    async execute(
        schoolId: string,
        dto:      CancelSubscriptionDtoType,
    ): Promise<SubscriptionResponseData> {

        // ── Find active subscription ──────────────────────────────────────
        const subscription = await this.subscriptionRepository
            .findActiveBySchoolId(schoolId);

        if (!subscription) {
            throw new NotFoundError(SubscriptionErrorMessage.NOT_FOUND);
        }

        // ── Cancel ────────────────────────────────────────────────────────
        const updated = await this.subscriptionRepository.update(
            subscription.id,
            {
                cancelAtPeriodEnd: dto.cancelAtPeriodEnd,
                cancelledAt:       new Date(),
                status:            dto.cancelAtPeriodEnd
                                       ? "active"     // stays active till period end
                                       : "cancelled", // immediate cancel
            },
        );

        return this.subscriptionMapper.toResponse(updated);
    }
}