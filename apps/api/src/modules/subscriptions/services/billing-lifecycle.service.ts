import { PrismaClient } from "../../../generated/public/client";
import { AuditService } from "../../audit/services/audit.service";
import { ActorType } from "../../audit/domain/audit.enums";
import { BillingEngine } from "./billing-engine.service";
import { InvoiceService } from "./invoice.service";
import { UsageService } from "./usage.service";
import { BillingNotifier } from "./billing-notifier.service";
import { billingMessages } from "./billing.messages";
import { addCycle, addDays, addMonthsAnchored, priceFor, Cycle } from "../domain/billing.calendar";
import { DEFAULT_GRACE_DAYS, INVOICE_LEAD_DAYS, PENDING_ATTEMPT_RECHECK_MINUTES, REMINDER_DAYS } from "../domain/billing.policy";

interface Dependencies {
    prismaClient: PrismaClient; billingEngine: BillingEngine; invoiceService: InvoiceService; usageService: UsageService;
    billingNotifier: BillingNotifier; auditService: AuditService; entitlementsService: { invalidate(schoolId: string): void };
}

export interface LifecycleSummary {
    reconciled: number; freeRolled: number; movedToFree: number; invoicesCreated: number; remindersSent: number;
    charged: number; markedPastDue: number; lapsed: number; downgradesCancelled: number; staleUpgradesVoided: number; errors: number;
}

const BATCH = 300;

/*
|--------------------------------------------------------------------------
| BILLING LIFECYCLE: the hourly job. Every step is safe to run twice (it asks the database what is still
| to do), and one school's failure never stops the others. Order matters:
|   1 reconcile payments that are still pending      6 charge saved cards that are due
|   2 roll Free schools forward (they never expire)  7 mark unpaid renewals past due
|   3 apply cancellations / scheduled moves to Free  8 lapse: unpaid past the grace period -> Free
|   4 create renewal invoices (3 days ahead)         9 tidy: void upgrade invoices nobody paid
|   5 send reminders (each only once)
| The rules are in billing.policy.ts.
|--------------------------------------------------------------------------
*/
export class BillingLifecycleService {
    private readonly prisma: PrismaClient;
    private readonly d: Dependencies;
    constructor(d: Dependencies) { this.d = d; this.prisma = d.prismaClient; }

    private invalidate(schoolId: string) { try { this.d.entitlementsService.invalidate(schoolId); } catch { /* cache only */ } }

    async run(now: Date = new Date()): Promise<LifecycleSummary> {
        const out: LifecycleSummary = { reconciled: 0, freeRolled: 0, movedToFree: 0, invoicesCreated: 0, remindersSent: 0, charged: 0, markedPastDue: 0, lapsed: 0, downgradesCancelled: 0, staleUpgradesVoided: 0, errors: 0 };
        const settings = await this.prisma.platformSettings.findFirst({ select: { subscriptionGracePeriodDays: true } });
        const grace = settings?.subscriptionGracePeriodDays ?? DEFAULT_GRACE_DAYS;

        const step = async (name: string, fn: () => Promise<void>) => {
            try { await fn(); } catch (err) { out.errors++; console.error(`[billing] step "${name}" failed:`, (err as Error).message); }
        };
        const each = async <T>(rows: T[], fn: (row: T) => Promise<void>) => {
            for (const row of rows) { try { await fn(row); } catch (err) { out.errors++; console.error("[billing] item failed:", (err as Error).message); } }
        };

        // 1. Pending payments older than a few minutes
        await step("reconcile", async () => {
            const pending = await this.prisma.paymentAttempt.findMany({
                where: { status: "pending", method: { not: "manual" }, createdAt: { lt: new Date(now.getTime() - PENDING_ATTEMPT_RECHECK_MINUTES * 60_000) } },
                orderBy: { createdAt: "asc" }, take: BATCH, select: { reference: true },
            });
            await each(pending, async a => { await this.d.billingEngine.reconcile(a.reference); out.reconciled++; });
        });

        // 2. Free schools never expire: their period just rolls forward
        await step("free-roll", async () => {
            const subs = await this.prisma.subscription.findMany({
                where: { status: "active", currentPeriodEnd: { lte: now }, plan: { monthlyPriceKobo: 0, yearlyPriceKobo: 0 } }, take: BATCH,
            });
            await each(subs, async s => {
                const anchor = s.currentPeriodEnd.getUTCDate();      // a Free period simply keeps its own day
                let start = s.currentPeriodEnd, end = addMonthsAnchored(start, 1, anchor);
                for (let i = 0; i < 60 && end <= now; i++) { start = end; end = addMonthsAnchored(start, 1, anchor); }
                await this.prisma.subscription.update({ where: { id: s.id }, data: { currentPeriodStart: start, currentPeriodEnd: end, nextBillingDate: null } });
                out.freeRolled++;
            });
        });

        // 3. Period ended and the school asked to cancel, or a scheduled downgrade targets the Free plan
        await step("period-end-transitions", async () => {
            const subs = await this.prisma.subscription.findMany({
                where: { status: { in: ["active", "trialing"] }, currentPeriodEnd: { lte: now }, OR: [{ cancelAtPeriodEnd: true }, { scheduledDowngradePlanId: { not: null } }] },
                take: BATCH,
            });
            await each(subs, async s => {
                if (s.cancelAtPeriodEnd) { await this.moveToFree(s.id, "cancelled", now); out.movedToFree++; return; }
                const target = await this.prisma.plan.findUnique({ where: { id: s.scheduledDowngradePlanId! } });
                if (target && target.monthlyPriceKobo === 0 && target.yearlyPriceKobo === 0) { await this.moveToFree(s.id, "cancelled", now); out.movedToFree++; }
            });
        });

        // 4. Renewal invoices, a few days before the period ends
        await step("renewal-invoices", async () => {
            const subs = await this.prisma.subscription.findMany({
                where: { status: { in: ["active", "trialing"] }, cancelAtPeriodEnd: false, currentPeriodEnd: { lte: addDays(now, INVOICE_LEAD_DAYS) }, plan: { monthlyPriceKobo: { gt: 0 } } },
                include: { plan: true }, take: BATCH,
            });
            await each(subs, async s => {
                let targetPlan = s.plan;
                if (s.scheduledDowngradePlanId) {
                    const target = await this.prisma.plan.findUnique({ where: { id: s.scheduledDowngradePlanId } });
                    const violations = target ? await this.d.usageService.violations(s.schoolId, target.id) : [{ feature: "plan", name: "plan", limit: 0, usage: 1 }];
                    if (target && target.isActive && violations.length === 0) targetPlan = target;
                    else {
                        await this.prisma.subscription.update({ where: { id: s.id }, data: { scheduledDowngradePlanId: null } });
                        await this.d.billingNotifier.send(s.schoolId, billingMessages.downgradeCancelled(target?.name ?? "the new plan",
                            violations.length ? "your school now uses more than that plan allows" : "that plan is no longer available"));
                        out.downgradesCancelled++;
                    }
                }
                const cycle = s.billingCycle as Cycle;
                const price = priceFor(targetPlan, cycle);
                if (price <= 0) return;

                const anchor = (s as any).billingAnchorDay ?? 1;
                const periodStart = s.currentPeriodEnd;
                const auto = s.autoRenew && !!(s as any).paymentMethodId;
                const { invoice, created } = await this.d.invoiceService.create({
                    subscriptionId: s.id, schoolId: s.schoolId, planId: targetPlan.id, cycle, reason: "renewal",
                    periodStart, periodEnd: addCycle(periodStart, cycle, anchor),
                    items: [{ kind: "plan", description: `${targetPlan.name} (${cycle})`, amountKobo: price }],
                    subtotalKobo: price, discountKobo: 0, totalKobo: price, dueDate: periodStart,
                    nextAttemptAt: auto ? (periodStart > now ? periodStart : now) : null,
                    idempotencyKey: `renew:${s.id}:${periodStart.getTime()}`,
                });
                if (created) {
                    const m = auto ? await this.prisma.paymentMethod.findUnique({ where: { id: (s as any).paymentMethodId } }) : null;
                    await this.d.billingNotifier.send(s.schoolId, billingMessages.invoiceIssued(targetPlan.name, invoice.totalKobo, invoice.dueDate, m?.last4 ?? undefined));
                    out.invoicesCreated++;
                }
            });
        });

        // 5. Reminders: the nearest threshold that applies, sent once
        await step("reminders", async () => {
            const subs = await this.prisma.subscription.findMany({
                where: { status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: { gt: now, lte: addDays(now, Math.max(...REMINDER_DAYS)) }, plan: { monthlyPriceKobo: { gt: 0 } } },
                include: { plan: true }, take: BATCH,
            });
            await each(subs, async s => {
                const daysLeft = Math.ceil((s.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000);
                const threshold = [...REMINDER_DAYS].sort((a, b) => a - b).find(d => d >= daysLeft);
                if (threshold === undefined) return;
                const m = s.autoRenew && (s as any).paymentMethodId ? await this.prisma.paymentMethod.findUnique({ where: { id: (s as any).paymentMethodId } }) : null;
                const sent = await this.d.billingNotifier.sendOnce(s.id, s.currentPeriodEnd, `T-${threshold}`, s.schoolId,
                    billingMessages.reminder(s.plan.name, threshold, s.currentPeriodEnd, m?.last4 ?? undefined));
                if (sent) out.remindersSent++;
            });
        });

        // 6. Charge saved cards that are due (first attempt on the due date, retries inside the grace period)
        await step("charge-due", async () => {
            const due = await this.prisma.subscriptionInvoice.findMany({
                where: { status: "open", nextAttemptAt: { lte: now } }, orderBy: { nextAttemptAt: "asc" }, take: BATCH, select: { id: true },
            });
            await each(due, async i => { const r = await this.d.billingEngine.chargeSavedCard(i.id, now); if (r !== "skipped") out.charged++; });
        });

        // 7. A renewal that is past its due date puts the school "past due" (it keeps its plan during the grace period)
        await step("past-due", async () => {
            const overdue = await this.prisma.subscriptionInvoice.findMany({
                where: { status: "open", reason: "renewal", dueDate: { lt: now }, subscription: { status: { in: ["active", "trialing"] } } },
                include: { plan: { select: { name: true } } }, take: BATCH,
            });
            await each(overdue, async i => {
                await this.prisma.subscription.updateMany({ where: { id: i.subscriptionId, status: { in: ["active", "trialing"] } }, data: { status: "past_due" } });
                const sent = await this.d.billingNotifier.sendOnce(i.subscriptionId, i.periodStart, "past_due", i.schoolId, billingMessages.pastDue(i.plan.name, addDays(i.dueDate, grace)));
                if (sent) out.markedPastDue++;
            });
        });

        // 8. Grace period over and still unpaid: back to Free, data intact
        await step("lapse", async () => {
            const lapsed = await this.prisma.subscriptionInvoice.findMany({
                where: { status: "open", reason: "renewal", dueDate: { lt: addDays(now, -grace) } }, take: BATCH, select: { subscriptionId: true },
            });
            await each(lapsed, async i => { await this.moveToFree(i.subscriptionId, "lapsed", now); out.lapsed++; });
        });

        // 9. Upgrade invoices nobody paid within a week are voided
        await step("stale-upgrades", async () => {
            const r = await this.prisma.subscriptionInvoice.updateMany({
                where: { status: "open", reason: "upgrade", createdAt: { lt: addDays(now, -7) } },
                data: { status: "void", voidedAt: now, note: "Not paid within 7 days" },
            });
            out.staleUpgradesVoided = r.count;
        });

        return out;
    }

    /**
     * Moves a school to the Free plan. "lapsed": unpaid, so the lost plan is remembered for "restore" and open
     * invoices are written off. "cancelled": the school chose it, so open invoices are simply voided.
     * The saved card is kept, so restoring a plan later is one click. Data is never touched.
     */
    async moveToFree(subscriptionId: string, mode: "lapsed" | "cancelled", now: Date = new Date(), actorId?: string): Promise<void> {
        const free = await this.prisma.plan.findFirst({ where: { systemKey: "free" } as never });
        if (!free) throw new Error("The Free plan is missing (run the registry sync)");
        const sub = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { plan: true } });
        if (sub.planId === free.id && mode === "lapsed") return;

        const wasPaid = sub.plan.monthlyPriceKobo > 0;
        await this.prisma.$transaction([
            this.prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    planId: free.id, status: "active", billingCycle: "monthly", currentPeriodStart: now,
                    currentPeriodEnd: addMonthsAnchored(now, 1, now.getUTCDate()), nextBillingDate: null, billingAnchorDay: now.getUTCDate(),
                    autoRenew: false, cancelAtPeriodEnd: false, scheduledDowngradePlanId: null, trialEndsAt: null, failedBillingCount: 0,
                    lapsedPlanId: mode === "lapsed" && wasPaid ? sub.planId : null,
                    cancelledAt: mode === "cancelled" ? now : sub.cancelledAt,
                } as never,
            }),
            this.prisma.subscriptionInvoice.updateMany({
                where: { subscriptionId: sub.id, status: "open" },
                data: mode === "lapsed"
                    ? { status: "uncollectible", nextAttemptAt: null, note: "Unpaid past the grace period" }
                    : { status: "void", voidedAt: now, nextAttemptAt: null, note: "Subscription ended" },
            }),
        ]);
        this.invalidate(sub.schoolId);
        await this.d.auditService.log({
            ...(actorId ? { userId: actorId } : { actorType: ActorType.SYSTEM }), schoolId: sub.schoolId,
            action: mode === "lapsed" ? "subscription.lapsed_to_free" : "subscription.moved_to_free",
            entity: "Subscription", entityId: sub.id, metadata: { fromPlanId: sub.planId },
        });
        await this.d.billingNotifier.send(sub.schoolId, mode === "lapsed" ? billingMessages.lapsed(sub.plan.name) : billingMessages.movedToFree());
    }
}
