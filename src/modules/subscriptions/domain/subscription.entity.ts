import { SubscriptionStatus, BillingCycle } from "../../../generated/prisma/client";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION DOMAIN ENTITIES
|--------------------------------------------------------------------------
*/

export interface SubscriptionEntity {
    id:                      string;
    schoolId:                string;
    planId:                  string;
    status:                  SubscriptionStatus;
    billingCycle:            BillingCycle;
    currentPeriodStart:      Date;
    currentPeriodEnd:        Date;
    trialEndsAt:             Date | null;
    cancelAtPeriodEnd:       boolean;
    cancelledAt:             Date | null;
    couponId:                string | null;
    discountedPriceKobo:     number | null;
    setupFeePaid:            boolean;
    setupFeePaidAt:          Date | null;
    paystackCustomerCode:    string | null;
    paystackSubscriptionCode: string | null;
    nextBillingDate:         Date | null;
    lastBillingAttemptAt:    Date | null;
    failedBillingCount:      number;
    createdAt:               Date;
    updatedAt:               Date;
}

export interface BillingHistoryEntity {
    id:                string;
    subscriptionId:    string;
    amountKobo:        number;
    status:            string;
    billingCycle:      BillingCycle;
    paystackReference: string | null;
    paidAt:            Date | null;
    failureReason:     string | null;
    createdAt:         Date;
}