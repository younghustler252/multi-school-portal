import { Subscription }          from "../../../generated/prisma/client";
import { IMapper }               from "../../../infrastructure/repository/base.repository";
import { SubscriptionEntity }    from "../domain/subscription.entity";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION MAPPER
|--------------------------------------------------------------------------
*/

export interface SubscriptionResponseData {
    id:                  string;
    schoolId:            string;
    planId:              string;
    status:              string;
    billingCycle:        string;
    currentPeriodStart:  Date;
    currentPeriodEnd:    Date;
    trialEndsAt:         Date | null;
    cancelAtPeriodEnd:   boolean;
    cancelledAt:         Date | null;
    setupFeePaid:        boolean;
    nextBillingDate:     Date | null;
    createdAt:           Date;
}

export class SubscriptionMapper
    implements IMapper<Subscription, SubscriptionEntity>
{
    toDomain(raw: Subscription): SubscriptionEntity {
        return {
            id:                       raw.id,
            schoolId:                 raw.schoolId,
            planId:                   raw.planId,
            status:                   raw.status,
            billingCycle:             raw.billingCycle,
            currentPeriodStart:       raw.currentPeriodStart,
            currentPeriodEnd:         raw.currentPeriodEnd,
            trialEndsAt:              raw.trialEndsAt,
            cancelAtPeriodEnd:        raw.cancelAtPeriodEnd,
            cancelledAt:              raw.cancelledAt,
            couponId:                 raw.couponId,
            discountedPriceKobo:      raw.discountedPriceKobo,
            setupFeePaid:             raw.setupFeePaid,
            setupFeePaidAt:           raw.setupFeePaidAt,
            paystackCustomerCode:     raw.paystackCustomerCode,
            paystackSubscriptionCode: raw.paystackSubscriptionCode,
            nextBillingDate:          raw.nextBillingDate,
            lastBillingAttemptAt:     raw.lastBillingAttemptAt,
            failedBillingCount:       raw.failedBillingCount,
            createdAt:                raw.createdAt,
            updatedAt:                raw.updatedAt,
        };
    }

    toResponse(entity: SubscriptionEntity): SubscriptionResponseData {
        return {
            id:                  entity.id,
            schoolId:            entity.schoolId,
            planId:              entity.planId,
            status:              entity.status,
            billingCycle:        entity.billingCycle,
            currentPeriodStart:  entity.currentPeriodStart,
            currentPeriodEnd:    entity.currentPeriodEnd,
            trialEndsAt:         entity.trialEndsAt,
            cancelAtPeriodEnd:   entity.cancelAtPeriodEnd,
            cancelledAt:         entity.cancelledAt,
            setupFeePaid:        entity.setupFeePaid,
            nextBillingDate:     entity.nextBillingDate,
            createdAt:           entity.createdAt,
        };
    }
}