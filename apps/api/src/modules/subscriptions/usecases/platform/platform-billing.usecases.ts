import { PrismaClient } from "../../../../generated/public/client";
import { IPlanRepository } from "../../../plans/repositories/plan.repository";
import { PlanMapper } from "../../../plans/mappers/plan.mapper";
import { PlanEntitlementService } from "../../../plans/services/plan-entitlement.service";
import { AuditService } from "../../../audit/services/audit.service";
import { ISubscriptionRepository } from "../../repositories/subscription.repository";
import { InvoiceRepository, toInvoice } from "../../repositories/invoice.repository";
import { SubscriptionMapper } from "../../mappers/subscription.mapper";
import { InvoiceService } from "../../services/invoice.service";
import { BillingEngine } from "../../services/billing-engine.service";
import { BillingLifecycleService } from "../../services/billing-lifecycle.service";
import { BillingNotifier } from "../../services/billing-notifier.service";
import { billingMessages } from "../../services/billing.messages";
import { billingErrors } from "../../domain/subscription.errors";
import { addCycle, addDays, monthlyEquivalent, Cycle } from "../../domain/billing.calendar";
import { LIVE_STATUSES } from "../../domain/billing.policy";
import {
    ListPaymentExceptionsQueryType, ResolvePaymentExceptionDtoType, ListSubscriptionsQueryType, PlatformChangePlanDtoType, ExtendPeriodDtoType, VoidInvoiceDtoType, MarkInvoicePaidDtoType, ListPlatformInvoicesQueryType,
} from "../../dtos/subscription.dto";

interface Dependencies {
    prismaClient: PrismaClient; planRepository: IPlanRepository; planMapper: PlanMapper; planEntitlementService: PlanEntitlementService;
    auditService: AuditService; subscriptionRepository: ISubscriptionRepository; invoiceRepository: InvoiceRepository;
    subscriptionMapper: SubscriptionMapper; invoiceService: InvoiceService; billingEngine: BillingEngine;
    billingLifecycleService: BillingLifecycleService; billingNotifier: BillingNotifier; entitlementsService: { invalidate(schoolId: string): void };
}

// PLATFORM: all subscriptions, one query (the old listing made two lookups per row)
export class ListSubscriptionsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListSubscriptionsQueryType) {
        const r = await this.d.subscriptionRepository.listForPlatform(q);
        return {
            data: r.data.map(s => ({ ...this.d.subscriptionMapper.toResponse(s), schoolName: s.schoolName, schoolSubdomain: s.schoolSubdomain, planName: s.planName, monthlyEquivalentKobo: s.priceKobo })),
            meta: r.meta,
        };
    }
}

// PLATFORM: one school's billing in full (subscription, plan, open and recent invoices, card on file)
export class GetSchoolSubscriptionUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string) {
        const d = this.d;
        const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!sub) throw billingErrors.notFound();
        const [plan, invoices, methods] = await Promise.all([
            d.planRepository.findById(sub.planId),
            d.invoiceRepository.paginate({ schoolId }, 1, 10),
            d.invoiceRepository.listMethods(schoolId),
        ]);
        const views = plan ? await d.planEntitlementService.describe([plan.id], "platform") : new Map();
        return {
            subscription: d.subscriptionMapper.toResponse(sub),
            plan: plan ? d.planMapper.toResponse(plan, views.get(plan.id) ?? []) : null,
            recentInvoices: invoices.data.map(i => d.subscriptionMapper.invoiceToResponse(i)),
            paymentMethod: methods[0] ? d.subscriptionMapper.methodToResponse(methods[0]) : null,
        };
    }
}

/*
| CHANGE A SCHOOL'S PLAN (platform support / sales). Complimentary: no payment is taken. It is recorded as a
| zero-value invoice with the reason, so billing history always explains why a school is on a plan. After the
| complimentary period (or at the next renewal) the school is invoiced the plan's normal price.
*/
export class PlatformChangePlanUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorId: string, dto: PlatformChangePlanDtoType) {
        const d = this.d;
        const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!sub) throw billingErrors.notFound();
        const plan = await d.planRepository.findById(dto.planId);
        if (!plan || !plan.isActive) throw billingErrors.planUnavailable();
        const cycle = (dto.billingCycle ?? sub.billingCycle) as Cycle;
        const now = new Date();

        if (plan.monthlyPriceKobo === 0 && plan.yearlyPriceKobo === 0) {
            await d.billingLifecycleService.moveToFree(sub.id, "cancelled", now, actorId);
        } else {
            const anchor = now.getUTCDate();
            const periodEnd = dto.periodEndsAt ? new Date(dto.periodEndsAt) : addCycle(now, cycle, anchor);
            if (periodEnd <= now) throw billingErrors.badExtension();
            await d.invoiceService.voidOpenUpgrades(sub.id);
            const { invoice } = await d.invoiceService.create({
                subscriptionId: sub.id, schoolId, planId: plan.id, cycle, reason: "adjustment", periodStart: now, periodEnd,
                items: [{ kind: "adjustment", description: `${plan.name} (complimentary): ${dto.reason}`, amountKobo: 0 }],
                subtotalKobo: 0, discountKobo: 0, totalKobo: 0, dueDate: now, createdById: actorId, note: dto.reason,
            });
            await d.billingEngine.applyWithoutPayment(invoice.id, actorId, dto.reason);
        }
        await d.auditService.log({ userId: actorId, schoolId, action: "subscription.plan_changed_by_platform", entity: "Subscription", entityId: sub.id, newValue: { toPlan: plan.name }, metadata: { reason: dto.reason } });
        return this.d.subscriptionMapper.toResponse((await d.subscriptionRepository.findActiveBySchoolId(schoolId))!);
    }
}

// EXTEND A PERIOD (goodwill, a payment delayed by the bank). Open renewal invoices are voided and recreated for the new end date.
export class ExtendPeriodUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorId: string, dto: ExtendPeriodDtoType) {
        const d = this.d;
        const sub = await d.subscriptionRepository.findActiveBySchoolId(schoolId);
        if (!sub) throw billingErrors.notFound();
        if (dto.days < 1 || dto.days > 90) throw billingErrors.badExtension();

        const newEnd = addDays(sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date(), dto.days);
        await d.prismaClient.subscriptionInvoice.updateMany({
            where: { subscriptionId: sub.id, status: "open", reason: "renewal" },
            data: { status: "void", voidedAt: new Date(), nextAttemptAt: null, note: `Period extended by ${dto.days} days` },
        });
        const updated = await d.subscriptionRepository.update(sub.id, { currentPeriodEnd: newEnd, nextBillingDate: newEnd, status: "active", failedBillingCount: 0 });
        try { d.entitlementsService.invalidate(schoolId); } catch { /* cache only */ }
        await d.auditService.log({ userId: actorId, schoolId, action: "subscription.period_extended", entity: "Subscription", entityId: sub.id, oldValue: { currentPeriodEnd: sub.currentPeriodEnd }, newValue: { currentPeriodEnd: newEnd }, metadata: { reason: dto.reason } });
        return d.subscriptionMapper.toResponse(updated);
    }
}

// PLATFORM INVOICES: the overdue list, void, and confirming a bank transfer
export class PlatformInvoicesUseCase {
    constructor(private readonly d: Dependencies) {}

    async list(q: ListPlatformInvoicesQueryType) {
        const where: Record<string, unknown> = { ...(q.status ? { status: q.status } : {}), ...(q.overdue ? { status: "open", dueDate: { lt: new Date() } } : {}) };
        const [total, rows] = await Promise.all([
            this.d.prismaClient.subscriptionInvoice.count({ where: where as never }),
            this.d.prismaClient.subscriptionInvoice.findMany({
                where: where as never, orderBy: { dueDate: "asc" }, skip: (q.page - 1) * q.limit, take: q.limit,
                include: { items: true, school: { select: { name: true, subdomain: true } } },
            }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / q.limit));
        return {
            data: rows.map(r => ({ ...this.d.subscriptionMapper.invoiceToResponse(toInvoice(r)), schoolId: r.schoolId, schoolName: r.school.name, schoolSubdomain: r.school.subdomain })),
            meta: { total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1 },
        };
    }

    /*
    | ONE SCHOOL'S BILLING HISTORY (GET /platform/subscriptions/:schoolId/invoices): every invoice the school ever had (open, paid, void,
    | uncollectible), newest first, each with its line items and its payment attempts, so support can answer "what did this school pay
    | and what failed". `summary` counts the school's whole history, not just the page. Read-only; money is kobo. Never returns a saved card
    | token or the provider's raw response.
    */
    async listForSchool(schoolId: string, q: ListPlatformInvoicesQueryType, now: Date = new Date()) {
        const school = await this.d.prismaClient.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, subdomain: true } });
        if (!school) throw billingErrors.notFound();
        const where: Record<string, unknown> = { schoolId, ...(q.status ? { status: q.status } : {}), ...(q.overdue ? { status: "open", dueDate: { lt: now } } : {}) };
        const [total, rows, byStatus] = await Promise.all([
            this.d.prismaClient.subscriptionInvoice.count({ where: where as never }),
            this.d.prismaClient.subscriptionInvoice.findMany({
                where: where as never, orderBy: [{ issuedAt: "desc" }, { id: "asc" }], skip: (q.page - 1) * q.limit, take: q.limit,
                include: { items: true, attempts: { orderBy: { createdAt: "desc" }, take: 20 } },
            }),
            this.d.prismaClient.subscriptionInvoice.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true }, _sum: { totalKobo: true, amountPaidKobo: true } }),
        ]);
        const sum = (st: string, f: "totalKobo" | "amountPaidKobo") => (byStatus.find(g => g.status === st)?._sum[f] as number | null | undefined) ?? 0;
        const totalPages = Math.max(1, Math.ceil(total / q.limit));
        return {
            school,
            summary: {
                invoiceCount: byStatus.reduce((n, g) => n + g._count._all, 0),
                paidCount: byStatus.find(g => g.status === "paid")?._count._all ?? 0,
                openCount: byStatus.find(g => g.status === "open")?._count._all ?? 0,
                paidKobo: sum("paid", "amountPaidKobo"),
                outstandingKobo: sum("open", "totalKobo") - sum("open", "amountPaidKobo"),
            },
            data: rows.map(r => ({
                ...this.d.subscriptionMapper.invoiceToResponse(toInvoice(r), now),
                attempts: r.attempts.map(a => ({ id: a.id, reference: a.reference, amountKobo: a.amountKobo, status: a.status, method: a.method, failureReason: a.failureReason, createdAt: a.createdAt, completedAt: a.completedAt })),
            })),
            meta: { total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1 },
        };
    }

    async void(invoiceId: string, actorId: string, dto: VoidInvoiceDtoType) {
        await this.d.billingEngine.voidInvoice(invoiceId, actorId, dto.reason);
        return { voided: true };
    }

    async markPaid(invoiceId: string, actorId: string, dto: MarkInvoicePaidDtoType) {
        await this.d.billingEngine.markPaidManually(invoiceId, actorId, dto.reference, dto.note);
        return { paid: true };
    }
}

/*
| CAPTURED-BUT-UNAPPLIED MONEY (REM-070). The billing engine records a row here, in the same transaction as the payment attempt, whenever the
| provider took money that could not be applied: a payment on a void invoice, a second payment for a paid invoice, an amount that does not
| match, or an invoice a later payment already superseded. A platform person works each one off: refund it at the provider (or apply it by
| hand), then close the row saying what was done. Nothing here moves money itself.
*/
export class PlatformPaymentExceptionsUseCase {
    constructor(private readonly d: Dependencies) {}

    async list(q: ListPaymentExceptionsQueryType) {
        const where = q.status ? { status: q.status } : {};
        const [total, rows, open] = await Promise.all([
            this.d.prismaClient.capturedPaymentException.count({ where }),
            this.d.prismaClient.capturedPaymentException.findMany({ where, orderBy: { createdAt: "asc" }, skip: (q.page - 1) * q.limit, take: q.limit }),
            this.d.prismaClient.capturedPaymentException.aggregate({ _count: { _all: true }, _sum: { amountKobo: true }, where: { status: "open" } }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / q.limit));
        return {
            data: rows, summary: { openCount: open._count._all, openAmountKobo: open._sum.amountKobo ?? 0 },
            meta: { total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1 },
        };
    }

    async resolve(id: string, actorId: string, dto: ResolvePaymentExceptionDtoType) {
        const r = await this.d.prismaClient.capturedPaymentException.updateMany({
            where: { id, status: "open" }, data: { status: dto.resolution, resolution: dto.note, resolvedById: actorId, resolvedAt: new Date() },
        });
        if (r.count === 0) {
            const exists = await this.d.prismaClient.capturedPaymentException.findUnique({ where: { id }, select: { id: true } });
            throw exists ? billingErrors.exceptionResolved() : billingErrors.exceptionNotFound();
        }
        const row = await this.d.prismaClient.capturedPaymentException.findUniqueOrThrow({ where: { id } });
        await this.d.auditService.log({
            userId: actorId, schoolId: row.schoolId, action: "billing.payment_exception_resolved", entity: "CapturedPaymentException", entityId: id,
            metadata: { resolution: dto.resolution, note: dto.note, kind: row.kind, reference: row.reference, amountKobo: row.amountKobo },
        });
        return { resolved: true };
    }
}

// PLATFORM STATS: real MRR (what live paid subscriptions bring in per month), collections and what is overdue
export class GetBillingStatsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute() {
        const d = this.d;
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const [byStatus, live, overdue, collected, distribution, trend, payingSchools] = await Promise.all([
            d.prismaClient.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
            d.prismaClient.subscription.findMany({ where: { status: { in: [...LIVE_STATUSES] } }, include: { plan: { select: { monthlyPriceKobo: true, yearlyPriceKobo: true } } } }),
            d.prismaClient.subscriptionInvoice.aggregate({ _count: { _all: true }, _sum: { totalKobo: true }, where: { status: "open", dueDate: { lt: now } } }),
            d.prismaClient.subscriptionInvoice.aggregate({ _sum: { amountPaidKobo: true }, where: { status: "paid", paidAt: { gte: monthStart } } }),
            d.subscriptionRepository.getPlanDistribution(),
            d.subscriptionRepository.getRevenueTrend(6),
            d.subscriptionRepository.countDistinctSchoolsWithSuccessfulBilling(),
        ]);
        const mrrKobo = live.filter(s => s.status !== "trialing").reduce((sum, s) => sum + monthlyEquivalent(s.plan, s.billingCycle as Cycle), 0);
        return {
            mrrKobo, arrKobo: mrrKobo * 12,
            collectedThisMonthKobo: collected._sum.amountPaidKobo ?? 0,
            overdueInvoices: overdue._count._all, overdueAmountKobo: overdue._sum.totalKobo ?? 0,
            payingSchools, subscriptionsByStatus: Object.fromEntries(byStatus.map(g => [g.status, g._count._all])),
            planDistribution: distribution, revenueTrend: trend,
        };
    }
}
