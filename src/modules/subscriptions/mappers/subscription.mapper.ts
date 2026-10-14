import { Subscription } from "../../../generated/public/client";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { SubscriptionEntity, InvoiceEntity, PaymentMethodEntity } from "../domain/subscription.entity";

export interface SubscriptionResponseData {
    id: string; schoolId: string; planId: string; status: string; billingCycle: string;
    currentPeriodStart: Date; currentPeriodEnd: Date; trialEndsAt: Date | null;
    cancelAtPeriodEnd: boolean; cancelledAt: Date | null; autoRenew: boolean; nextBillingDate: Date | null;
    scheduledDowngradePlanId: string | null; lapsedPlanId: string | null; createdAt: Date;
}

export interface InvoiceResponseData {
    id: string; number: string; reason: string; status: string; billingCycle: string; planId: string;
    periodStart: Date; periodEnd: Date; subtotalKobo: number; discountKobo: number; totalKobo: number; amountPaidKobo: number;
    dueDate: Date; issuedAt: Date; paidAt: Date | null; lastFailureReason: string | null; note: string | null;
    isOverdue: boolean; items: { kind: string; description: string; amountKobo: number }[];
}

export class SubscriptionMapper implements IMapper<Subscription, SubscriptionEntity> {

    toDomain(raw: Subscription): SubscriptionEntity {
        const r = raw as unknown as Subscription & {
            paymentMethodId?: string | null; billingAnchorDay?: number; lapsedPlanId?: string | null;
        };
        return {
            id: r.id, schoolId: r.schoolId, planId: r.planId, status: r.status, billingCycle: r.billingCycle,
            currentPeriodStart: r.currentPeriodStart, currentPeriodEnd: r.currentPeriodEnd, trialEndsAt: r.trialEndsAt,
            cancelAtPeriodEnd: r.cancelAtPeriodEnd, cancelledAt: r.cancelledAt, couponId: r.couponId, autoRenew: r.autoRenew,
            paymentMethodId: r.paymentMethodId ?? null, billingAnchorDay: r.billingAnchorDay ?? 1,
            scheduledDowngradePlanId: r.scheduledDowngradePlanId, lapsedPlanId: r.lapsedPlanId ?? null,
            nextBillingDate: r.nextBillingDate, failedBillingCount: r.failedBillingCount, createdAt: r.createdAt, updatedAt: r.updatedAt,
        };
    }

    toResponse(e: SubscriptionEntity): SubscriptionResponseData {
        return {
            id: e.id, schoolId: e.schoolId, planId: e.planId, status: e.status, billingCycle: e.billingCycle,
            currentPeriodStart: e.currentPeriodStart, currentPeriodEnd: e.currentPeriodEnd, trialEndsAt: e.trialEndsAt,
            cancelAtPeriodEnd: e.cancelAtPeriodEnd, cancelledAt: e.cancelledAt, autoRenew: e.autoRenew,
            nextBillingDate: e.nextBillingDate, scheduledDowngradePlanId: e.scheduledDowngradePlanId,
            lapsedPlanId: e.lapsedPlanId, createdAt: e.createdAt,
        };
    }

    invoiceToResponse(i: InvoiceEntity, now: Date = new Date()): InvoiceResponseData {
        return {
            id: i.id, number: i.number, reason: i.reason, status: i.status, billingCycle: i.billingCycle, planId: i.planId,
            periodStart: i.periodStart, periodEnd: i.periodEnd, subtotalKobo: i.subtotalKobo, discountKobo: i.discountKobo,
            totalKobo: i.totalKobo, amountPaidKobo: i.amountPaidKobo, dueDate: i.dueDate, issuedAt: i.issuedAt, paidAt: i.paidAt,
            lastFailureReason: i.status === "open" ? i.lastFailureReason : null, note: i.note,
            isOverdue: i.status === "open" && i.dueDate < now,
            items: (i.items ?? []).map(x => ({ kind: x.kind, description: x.description, amountKobo: x.amountKobo })),
        };
    }

    // Never includes the authorization code
    methodToResponse(m: PaymentMethodEntity) {
        return { id: m.id, brand: m.brand, last4: m.last4, expMonth: m.expMonth, expYear: m.expYear, bank: m.bank, isDefault: m.isDefault };
    }
}
