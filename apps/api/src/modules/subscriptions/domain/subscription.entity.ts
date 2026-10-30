import { SubscriptionStatus, BillingCycle } from "../../../generated/public/client";

export interface SubscriptionEntity {
    id:                       string;
    schoolId:                 string;
    planId:                   string;
    status:                   SubscriptionStatus;
    billingCycle:             BillingCycle;
    currentPeriodStart:       Date;
    currentPeriodEnd:         Date;
    trialEndsAt:              Date | null;
    cancelAtPeriodEnd:        boolean;
    cancelledAt:              Date | null;
    couponId:                 string | null;
    autoRenew:                boolean;
    paymentMethodId:          string | null;
    billingAnchorDay:         number;
    scheduledDowngradePlanId: string | null;
    lapsedPlanId:             string | null;
    nextBillingDate:          Date | null;
    failedBillingCount:       number;
    createdAt:                Date;
    updatedAt:                Date;
}

export interface InvoiceItemEntity {
    id: string; kind: string; description: string; amountKobo: number;
}

export interface InvoiceEntity {
    id:                string;
    number:            string;
    subscriptionId:    string;
    schoolId:          string;
    planId:            string;
    billingCycle:      BillingCycle;
    reason:            "upgrade" | "renewal" | "adjustment";
    status:            "open" | "paid" | "void" | "uncollectible";
    periodStart:       Date;
    periodEnd:         Date;
    subtotalKobo:      number;
    discountKobo:      number;
    totalKobo:         number;
    amountPaidKobo:    number;
    couponId:          string | null;
    dueDate:           Date;
    issuedAt:          Date;
    paidAt:            Date | null;
    voidedAt:          Date | null;
    attemptCount:      number;
    nextAttemptAt:     Date | null;
    lastFailureReason: string | null;
    note:              string | null;
    createdAt:         Date;
    items?:            InvoiceItemEntity[];
}

export interface PaymentMethodEntity {
    id:        string;
    schoolId:  string;
    brand:     string | null;
    last4:     string | null;
    expMonth:  number | null;
    expYear:   number | null;
    bank:      string | null;
    isDefault: boolean;
    createdAt: Date;
}
