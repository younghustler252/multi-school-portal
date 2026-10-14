import { PrismaClient } from "../../../generated/public/client";
import { IPlanRepository } from "../../plans/repositories/plan.repository";
import { PlanEntity } from "../../plans/domain/plan.entity";
import { ISubscriptionRepository } from "../repositories/subscription.repository";
import { SubscriptionEntity } from "../domain/subscription.entity";
import { UrlService } from "../../../shared/services/url.service";
import { CouponService, CouponRow } from "./coupon.service";
import { ProrationService, Quote } from "./proration.service";
import { billingErrors } from "../domain/subscription.errors";
import { monthlyEquivalent, priceFor, Cycle } from "../domain/billing.calendar";

interface Dependencies {
    prismaClient: PrismaClient; planRepository: IPlanRepository; subscriptionRepository: ISubscriptionRepository;
    couponService: CouponService; prorationService: ProrationService; urlService: UrlService;
}

export interface PreparedChange {
    sub: SubscriptionEntity; currentPlan: PlanEntity; newPlan: PlanEntity; cycle: Cycle; coupon: CouponRow | null; quote: Quote;
}

/*
| PLAN CHANGE: the checks shared by "preview" and "change". Preview and change always agree because they run
| the SAME code; nothing in a preview is computed anywhere else.
*/
export class PlanChangeService {
    private readonly d: Dependencies;
    constructor(d: Dependencies) { this.d = d; }

    async currentSubscription(schoolId: string): Promise<{ sub: SubscriptionEntity; plan: PlanEntity }> {
        const sub = await this.d.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!sub) throw billingErrors.notFound();
        const plan = await this.d.planRepository.findById(sub.planId);
        if (!plan) throw billingErrors.planNotFound();
        return { sub, plan };
    }

    async prepare(schoolId: string, input: { planId: string; billingCycle: Cycle; couponCode?: string }, now = new Date()): Promise<PreparedChange> {
        const d = this.d;
        const { sub, plan: currentPlan } = await this.currentSubscription(schoolId);
        const newPlan = await d.planRepository.findById(input.planId);
        if (!newPlan || !newPlan.isActive) throw billingErrors.planUnavailable();
        // A private (custom) plan can only be chosen by the school it was made for, or restored after a lapse
        if (!newPlan.isPublic && newPlan.id !== sub.planId && newPlan.id !== sub.lapsedPlanId) throw billingErrors.planUnavailable();

        const cycle = input.billingCycle;
        const newPrice = priceFor(newPlan, cycle);
        if (newPrice <= 0) throw billingErrors.freeIsDowngrade();

        const samePlan = newPlan.id === sub.planId;
        if (samePlan && cycle === sub.billingCycle && sub.status !== "trialing") throw billingErrors.noChange();
        const currentMonthly = sub.status === "trialing" ? 0 : monthlyEquivalent(currentPlan, sub.billingCycle);
        if (!samePlan && currentMonthly > 0 && monthlyEquivalent(newPlan, cycle) < currentMonthly) throw billingErrors.notAnUpgrade();

        const coupon = input.couponCode ? await d.couponService.validate(input.couponCode, now) : null;

        const setupPaid = await d.prismaClient.subscriptionInvoiceItem.aggregate({
            _sum: { amountKobo: true }, where: { kind: "setup_fee", invoice: { subscriptionId: sub.id, status: "paid" } },
        });
        const quote = d.prorationService.quote({
            sub, currentPlan, newPlan, cycle, now, coupon, setupAlreadyPaidKobo: setupPaid._sum.amountKobo ?? 0,
        });
        return { sub, currentPlan, newPlan, cycle, coupon, quote };
    }

    // Where the provider sends the person after paying (built here, never taken from the client)
    async callbackUrl(schoolId: string): Promise<string> {
        const school = await this.d.prismaClient.school.findUniqueOrThrow({
            where: { id: schoolId }, select: { subdomain: true, customDomain: true, customDomainVerifiedAt: true },
        });
        return this.d.urlService.schoolUrl(school, "/billing/callback");
    }
}
