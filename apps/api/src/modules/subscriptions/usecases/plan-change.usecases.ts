import { PrismaClient } from "../../../generated/public/client";
import { IPlanRepository } from "../../plans/repositories/plan.repository";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { AuditService } from "../../audit/services/audit.service";
import { ISubscriptionRepository } from "../repositories/subscription.repository";
import { SubscriptionMapper } from "../mappers/subscription.mapper";
import { PlanChangeService } from "../services/plan-change.service";
import { InvoiceService } from "../services/invoice.service";
import { BillingEngine } from "../services/billing-engine.service";
import { UsageService } from "../services/usage.service";
import { BillingNotifier } from "../services/billing-notifier.service";
import { billingMessages } from "../services/billing.messages";
import { billingErrors } from "../domain/subscription.errors";
import { monthlyEquivalent } from "../domain/billing.calendar";
import { PreviewChangeDtoType, ChangePlanDtoType, RequestDowngradeDtoType } from "../dtos/subscription.dto";

interface Dependencies {
    prismaClient: PrismaClient; planRepository: IPlanRepository; userRepository: IUserRepository; auditService: AuditService;
    subscriptionRepository: ISubscriptionRepository; subscriptionMapper: SubscriptionMapper; planChangeService: PlanChangeService;
    invoiceService: InvoiceService; billingEngine: BillingEngine; usageService: UsageService; billingNotifier: BillingNotifier;
}

/* PREVIEW: what the change would cost, line by line. Creates nothing. */
export class PreviewPlanChangeUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: PreviewChangeDtoType) {
        const p = await this.d.planChangeService.prepare(schoolId, dto);
        return {
            fromPlan: p.currentPlan.name, toPlan: p.newPlan.name, billingCycle: p.cycle, items: p.quote.items,
            subtotalKobo: p.quote.subtotalKobo, discountKobo: p.quote.discountKobo, totalKobo: p.quote.totalKobo,
            newPeriodStart: p.quote.periodStart, newPeriodEnd: p.quote.periodEnd, keepsRenewalDate: p.quote.keepsPeriod,
        };
    }
}

/*
| CHANGE PLAN (upgrade or billing-cycle switch).
| Creates an invoice from the same quote the preview showed. If nothing is due (a credit covers it) the change
| is applied at once; otherwise a checkout is started. The plan only changes when the PAYMENT is verified,
| never when the person is merely sent to the checkout page.
*/
export class ChangePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, userId: string, dto: ChangePlanDtoType & { autoRenew?: boolean }) {
        const d = this.d;
        const p = await d.planChangeService.prepare(schoolId, dto);
        const user = await d.userRepository.findById(userId);
        if (!user) throw billingErrors.notFound();

        await d.invoiceService.voidOpenUpgrades(p.sub.id);
        const { invoice } = await d.invoiceService.create({
            subscriptionId: p.sub.id, schoolId, planId: p.newPlan.id, cycle: p.cycle, reason: "upgrade",
            periodStart: p.quote.periodStart, periodEnd: p.quote.periodEnd, items: p.quote.items,
            subtotalKobo: p.quote.subtotalKobo, discountKobo: p.quote.discountKobo, totalKobo: p.quote.totalKobo,
            couponId: p.quote.couponId, dueDate: new Date(), createdById: userId,
        });
        await d.auditService.log({
            userId, schoolId, action: "subscription.change_requested", entity: "SubscriptionInvoice", entityId: invoice.id,
            newValue: { toPlan: p.newPlan.name, cycle: p.cycle, totalKobo: invoice.totalKobo },
        });

        if (invoice.totalKobo === 0) {
            await d.billingEngine.applyWithoutPayment(invoice.id, userId, "Credit covered the whole amount");
            const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
            return { status: "applied" as const, invoiceId: invoice.id, subscription: sub ? d.subscriptionMapper.toResponse(sub) : null };
        }

        const checkout = await d.billingEngine.startCheckout({
            invoiceId: invoice.id, schoolId, payerEmail: user.email, callbackUrl: await d.planChangeService.callbackUrl(schoolId), autoRenew: dto.autoRenew ?? false,
        });
        return { status: "requires_payment" as const, invoiceId: invoice.id, totalKobo: invoice.totalKobo, ...checkout };
    }
}

/*
| SCHEDULE A DOWNGRADE. Takes effect when the current paid period ends (the school keeps what it paid for).
| Refused if the school currently uses more than the new plan allows, with the exact numbers; it is checked
| again when the change is applied, so it can never leave a school over its limits.
*/
export class RequestDowngradeUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, userId: string, dto: RequestDowngradeDtoType) {
        const d = this.d;
        const { sub, plan: current } = await d.planChangeService.currentSubscription(schoolId);
        const target = await d.planRepository.findById(dto.planId);
        if (!target || !target.isActive) throw billingErrors.planUnavailable();
        if (!target.isPublic && target.id !== sub.lapsedPlanId) throw billingErrors.planUnavailable();
        if (target.id === sub.planId) throw billingErrors.noChange();
        if (monthlyEquivalent(target, sub.billingCycle) >= monthlyEquivalent(current, sub.billingCycle)) throw billingErrors.notADowngrade();

        const violations = await d.usageService.violations(schoolId, target.id);
        if (violations.length) throw billingErrors.downgradeBlocked(violations);

        const updated = await d.subscriptionRepository.update(sub.id, { scheduledDowngradePlanId: target.id });
        await d.auditService.log({ userId, schoolId, action: "subscription.downgrade_scheduled", entity: "Subscription", entityId: sub.id, newValue: { toPlan: target.name, effectiveAt: sub.currentPeriodEnd } });
        return { subscription: d.subscriptionMapper.toResponse(updated), effectiveAt: sub.currentPeriodEnd, toPlan: target.name };
    }

    async cancel(schoolId: string, userId: string) {
        const d = this.d;
        const { sub } = await d.planChangeService.currentSubscription(schoolId);
        if (!sub.scheduledDowngradePlanId) throw billingErrors.noScheduledChange();
        const updated = await d.subscriptionRepository.update(sub.id, { scheduledDowngradePlanId: null });
        await d.auditService.log({ userId, schoolId, action: "subscription.downgrade_cancelled", entity: "Subscription", entityId: sub.id });
        return { subscription: d.subscriptionMapper.toResponse(updated) };
    }
}
