import { PrismaClient } from "../../../generated/public/client";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { AuditService } from "../../audit/services/audit.service";
import { ISubscriptionRepository } from "../repositories/subscription.repository";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { SubscriptionMapper } from "../mappers/subscription.mapper";
import { BillingEngine } from "../services/billing-engine.service";
import { PlanChangeService } from "../services/plan-change.service";
import { BillingLifecycleService } from "../services/billing-lifecycle.service";
import { BillingNotifier } from "../services/billing-notifier.service";
import { billingMessages } from "../services/billing.messages";
import { billingErrors } from "../domain/subscription.errors";
import { ToggleAutoRenewDtoType, CancelSubscriptionDtoType } from "../dtos/subscription.dto";

interface Dependencies {
    prismaClient: PrismaClient; userRepository: IUserRepository; auditService: AuditService;
    subscriptionRepository: ISubscriptionRepository; invoiceRepository: InvoiceRepository; subscriptionMapper: SubscriptionMapper;
    billingEngine: BillingEngine; planChangeService: PlanChangeService; billingLifecycleService: BillingLifecycleService; billingNotifier: BillingNotifier;
}

/*
| VERIFY A PAYMENT after the person returns from the checkout page.
| The reference must belong to THIS school (any other answer is "not found", so references of other schools are
| never confirmed). It uses the same road as the webhook, so whichever arrives first wins and the other is a no-op.
*/
export class VerifyBillingPaymentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, reference: string) {
        const d = this.d;
        const attempt = await d.prismaClient.paymentAttempt.findUnique({ where: { reference }, include: { invoice: { select: { id: true, schoolId: true } } } });
        if (!attempt || attempt.invoice.schoolId !== schoolId) throw billingErrors.wrongSchool();

        await d.billingEngine.reconcile(reference);
        const [invoice, fresh] = await Promise.all([
            d.invoiceRepository.findByIdForSchool(attempt.invoice.id, schoolId),
            d.prismaClient.paymentAttempt.findUnique({ where: { reference }, select: { status: true, failureReason: true } }),
        ]);
        const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        return {
            status: (fresh?.status ?? "pending") as "pending" | "success" | "failed" | "abandoned",
            failureReason: fresh?.status === "failed" ? fresh.failureReason : null,
            invoice: invoice ? d.subscriptionMapper.invoiceToResponse(invoice) : null,
            subscription: sub ? d.subscriptionMapper.toResponse(sub) : null,
        };
    }
}

// PAY AN OPEN INVOICE (the "pay link": renewals, retries after a failed charge, restoring a lapsed plan)
export class PayInvoiceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, userId: string, invoiceId: string, autoRenew: boolean) {
        const user = await this.d.userRepository.findById(userId);
        if (!user) throw billingErrors.notFound();
        return this.d.billingEngine.startCheckout({
            invoiceId, schoolId, payerEmail: user.email, callbackUrl: await this.d.planChangeService.callbackUrl(schoolId), autoRenew,
        });
    }
}

export class ToggleAutoRenewUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, userId: string, dto: ToggleAutoRenewDtoType) {
        const d = this.d;
        const { sub } = await d.planChangeService.currentSubscription(schoolId);
        if (dto.enabled && !sub.paymentMethodId) throw billingErrors.needsCard();

        const updated = await d.subscriptionRepository.update(sub.id, { autoRenew: dto.enabled });
        // Keep the open renewal invoice in step: schedule its card charge, or cancel it
        await d.prismaClient.subscriptionInvoice.updateMany({
            where: { subscriptionId: sub.id, status: "open", reason: "renewal" },
            data: dto.enabled ? { nextAttemptAt: new Date() } : { nextAttemptAt: null },
        });
        await d.auditService.log({ userId, schoolId, action: dto.enabled ? "subscription.auto_renew_on" : "subscription.auto_renew_off", entity: "Subscription", entityId: sub.id });
        return d.subscriptionMapper.toResponse(updated);
    }
}

export class ManagePaymentMethodsUseCase {
    constructor(private readonly d: Dependencies) {}

    async list(schoolId: string) {
        return (await this.d.invoiceRepository.listMethods(schoolId)).map(m => this.d.subscriptionMapper.methodToResponse(m));
    }

    // Removing the card used for renewal turns automatic renewal off (nothing is ever charged without a saved card)
    async remove(schoolId: string, userId: string, methodId: string) {
        const d = this.d;
        const m = await d.prismaClient.paymentMethod.findFirst({ where: { id: methodId, schoolId, removedAt: null } });
        if (!m) throw billingErrors.methodNotFound();
        await d.prismaClient.paymentMethod.update({ where: { id: m.id }, data: { removedAt: new Date(), isDefault: false } });

        const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (sub && sub.paymentMethodId === m.id) {
            const next = await d.prismaClient.paymentMethod.findFirst({ where: { schoolId, removedAt: null }, orderBy: { createdAt: "desc" } });
            await d.subscriptionRepository.update(sub.id, next ? { paymentMethodId: next.id } : { paymentMethodId: null, autoRenew: false });
            if (next) await d.prismaClient.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
            else await d.prismaClient.subscriptionInvoice.updateMany({ where: { subscriptionId: sub.id, status: "open" }, data: { nextAttemptAt: null } });
        }
        await d.auditService.log({ userId, schoolId, action: "subscription.payment_method_removed", entity: "PaymentMethod", entityId: m.id });
        return { removed: true };
    }
}

/*
| CANCEL / RESUME.
| Cancelling does NOT lock the school out: at the end of the paid period the school moves to the Free plan
| (immediately, if asked) and keeps all its data. Open renewal invoices are voided so nothing is charged.
*/
export class CancelSubscriptionUseCase {
    constructor(private readonly d: Dependencies) {}

    async cancel(schoolId: string, userId: string, dto: CancelSubscriptionDtoType) {
        const d = this.d;
        const { sub, plan } = await d.planChangeService.currentSubscription(schoolId);
        if (plan.monthlyPriceKobo === 0 && plan.yearlyPriceKobo === 0) throw billingErrors.freeIsDowngrade();
        if (sub.cancelAtPeriodEnd && !dto.immediately) throw billingErrors.alreadyCancelling();

        if (dto.immediately) {
            await d.billingLifecycleService.moveToFree(sub.id, "cancelled", new Date(), userId);
        } else {
            await d.subscriptionRepository.update(sub.id, { cancelAtPeriodEnd: true, autoRenew: false });
            await d.prismaClient.subscriptionInvoice.updateMany({
                where: { subscriptionId: sub.id, status: "open", reason: "renewal" },
                data: { status: "void", voidedAt: new Date(), nextAttemptAt: null, note: "Cancellation requested" },
            });
            await d.billingNotifier.send(schoolId, billingMessages.cancelScheduled(sub.currentPeriodEnd));
        }
        await d.auditService.log({ userId, schoolId, action: "subscription.cancelled", entity: "Subscription", entityId: sub.id, metadata: { immediately: dto.immediately } });
        const fresh = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        return fresh ? d.subscriptionMapper.toResponse(fresh) : null;
    }

    async resume(schoolId: string, userId: string) {
        const d = this.d;
        const { sub } = await d.planChangeService.currentSubscription(schoolId);
        if (!sub.cancelAtPeriodEnd) throw billingErrors.notCancelling();
        const updated = await d.subscriptionRepository.update(sub.id, { cancelAtPeriodEnd: false });
        await d.auditService.log({ userId, schoolId, action: "subscription.resumed", entity: "Subscription", entityId: sub.id });
        return d.subscriptionMapper.toResponse(updated);     // the hourly job creates the renewal invoice again
    }
}
