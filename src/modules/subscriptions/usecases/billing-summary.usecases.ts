import { PrismaClient } from "../../../generated/public/client";
import { IPlanRepository } from "../../plans/repositories/plan.repository";
import { PlanMapper } from "../../plans/mappers/plan.mapper";
import { PlanEntitlementService } from "../../plans/services/plan-entitlement.service";
import { ISubscriptionRepository } from "../repositories/subscription.repository";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { SubscriptionMapper } from "../mappers/subscription.mapper";
import { UsageService } from "../services/usage.service";
import { billingErrors } from "../domain/subscription.errors";
import { addDays } from "../domain/billing.calendar";
import { DEFAULT_GRACE_DAYS } from "../domain/billing.policy";
import { ListInvoicesQueryType } from "../dtos/subscription.dto";

interface Dependencies {
    prismaClient: PrismaClient; planRepository: IPlanRepository; planMapper: PlanMapper; planEntitlementService: PlanEntitlementService;
    subscriptionRepository: ISubscriptionRepository; invoiceRepository: InvoiceRepository; subscriptionMapper: SubscriptionMapper; usageService: UsageService;
}

const LIMIT_METERS: Record<string, string> = { "students.max": "students.active", "staff.max": "staff.active" };

/*
| BILLING SUMMARY (school realm): everything the billing page needs in one call.
| `standing` tells modules and the frontend whether the school is in good standing; a school that is past due
| keeps its plan and features until `graceEndsAt`.
*/
export class GetBillingSummaryUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string) {
        const d = this.d;
        const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!sub) throw billingErrors.notFound();
        const [plan, lapsed, scheduled] = await Promise.all([
            d.planRepository.findById(sub.planId),
            sub.lapsedPlanId ? d.planRepository.findById(sub.lapsedPlanId) : null,
            sub.scheduledDowngradePlanId ? d.planRepository.findById(sub.scheduledDowngradePlanId) : null,
        ]);
        if (!plan) throw billingErrors.planNotFound();

        const [views, openInvoices, methods, settings, usage] = await Promise.all([
            d.planEntitlementService.describe([plan.id], "public"),
            d.invoiceRepository.findOpenForSubscription(sub.id),
            d.invoiceRepository.listMethods(schoolId),
            d.prismaClient.platformSettings.findFirst({ select: { subscriptionGracePeriodDays: true } }),
            d.usageService.currentUsage(schoolId),
        ]);
        const entitlements = views.get(plan.id) ?? [];

        const grace = settings?.subscriptionGracePeriodDays ?? DEFAULT_GRACE_DAYS;
        const now = new Date();
        const overdue = openInvoices.filter(i => i.dueDate < now).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
        const upcoming = openInvoices.find(i => i.reason === "renewal") ?? null;

        return {
            subscription: d.subscriptionMapper.toResponse(sub),
            plan: d.planMapper.toResponse(plan, entitlements),
            standing: overdue ? "past_due" as const : "good" as const,
            graceEndsAt: overdue ? addDays(overdue.dueDate, grace) : null,
            upcomingInvoice: upcoming ? d.subscriptionMapper.invoiceToResponse(upcoming, now) : null,
            openInvoices: openInvoices.map(i => d.subscriptionMapper.invoiceToResponse(i, now)),
            paymentMethod: methods[0] ? d.subscriptionMapper.methodToResponse(methods[0]) : null,
            scheduledDowngrade: scheduled ? { planId: scheduled.id, planName: scheduled.name, effectiveAt: sub.currentPeriodEnd } : null,
            restorePlan: lapsed ? { planId: lapsed.id, planName: lapsed.name } : null,
            usage: entitlements.filter(e => e.kind === "LIMIT" && LIMIT_METERS[e.key]).map(e => ({
                key: e.key, name: e.name, limit: e.unlimited ? null : (e.value as number), used: usage.get(LIMIT_METERS[e.key]) ?? 0,
            })),
        };
    }
}

export class ListMyInvoicesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, q: ListInvoicesQueryType) {
        const r = await this.d.invoiceRepository.paginate({ schoolId, ...(q.status ? { status: q.status } : {}) }, q.page, q.limit);
        const now = new Date();
        return { data: r.data.map(i => this.d.subscriptionMapper.invoiceToResponse(i, now)), meta: r.meta };
    }
}

export class GetMyInvoiceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, invoiceId: string) {
        const invoice = await this.d.invoiceRepository.findByIdForSchool(invoiceId, schoolId);
        if (!invoice) throw billingErrors.invoiceNotFound();
        return this.d.subscriptionMapper.invoiceToResponse(invoice);
    }
}
