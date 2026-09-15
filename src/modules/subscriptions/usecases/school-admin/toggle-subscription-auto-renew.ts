import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { NotFoundError, BadRequestError } from "../../../../shared/errors/domain.errors";
import { SubscriptionErrorMessage } from "../../domain/subscription.enums";
import { ToggleAutoRenewDtoType } from "../../dtos/subscription.dto";
import { prisma } from "../../../../infrastructure/database/prisma/prisma.client";

interface Dependencies {
    subscriptionRepository: ISubscriptionRepository;
}

export class ToggleSubscriptionAutoRenewUseCase {
    private readonly subscriptionRepository: ISubscriptionRepository;

    constructor({ subscriptionRepository }: Dependencies) {
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute(
        schoolId: string,
        dto: ToggleAutoRenewDtoType,
    ) {
        const subscription =
            await this.subscriptionRepository.findActiveBySchoolId(schoolId);

        if (!subscription) {
            throw new NotFoundError(
                SubscriptionErrorMessage.NOT_FOUND,
            );
        }

        // Enabling auto-renew requires a reusable Paystack
        // authorization code from a previous card payment.
        if (
            dto.enabled &&
            !subscription.paystackAuthorizationCode
        ) {
            throw new BadRequestError(
                SubscriptionErrorMessage.AUTO_RENEW_REQUIRES_CARD_PAYMENT,
            );

        }

        const updatedSubscription =
            await prisma.subscription.update({
                where: {
                    id: subscription.id,
                },
                data: {
                    autoRenew: dto.enabled,
                },
            });

        return {
            autoRenew: updatedSubscription.autoRenew,
        };
    }
}
