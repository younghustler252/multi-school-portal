import { Prisma, PrismaClient } from "../../../generated/public/client";
import { IPaymentProvider, PaymentProviderError, VerifyTransactionResult } from "../../../../src/infrastructure/payments/interfaces/payment.provider.interface";
import { EncryptionService } from "../../../shared/services/encryption.service";
import { AuditService } from "../../audit/services/audit.service";
import { ActorType } from "../../audit/domain/audit.enums";
import { BillingNotifier } from "./billing-notifier.service";
import { billingMessages } from "./billing.messages";
import { billingErrors } from "../domain/subscription.errors";
import { CURRENCY, DEFAULT_GRACE_DAYS, dunningOffsets, SYSTEM_BILLING_ACTOR } from "../domain/billing.policy";
import { addDays } from "../domain/billing.calendar";

interface Dependencies {
    prismaClient: PrismaClient; paymentProvider: IPaymentProvider; encryptionService: EncryptionService;
    billingNotifier: BillingNotifier; auditService: AuditService;
    entitlementsService: { invalidate(schoolId: string): void };
}

export type SettleOutcome = "paid" | "failed" | "pending" | "duplicate" | "paid_on_void" | "mismatch" | "ignored";

interface Applied { schoolId: string; planId: string; periodEnd: Date; totalKobo: number; reason: string; invoiceId: string; cardSaved: boolean }

/*
|--------------------------------------------------------------------------
| BILLING ENGINE: the ONLY code that moves money into subscription state.
|
| One road in for every payment, whoever noticed it first (the browser coming back, the provider's webhook, the
| reconciliation job, a saved-card charge, a manual bank-transfer confirmation):
|     attempt  ->  verify with the provider  ->  settle  ->  apply the invoice to the subscription
|
|  SAFE TO REPEAT   applying locks the invoice row, so two callers at the same moment cannot both apply it;
|                   a second payment for a paid invoice is recorded as a duplicate, never applied twice.
|  CHECKED          the amount and currency the provider reports must match the attempt, or nothing is applied.
|  NEVER GUESSED    a charge with an unknown outcome (timeout) stays "pending" and is verified later by its
|                   reference; the reference is deterministic, so a retry can never charge a card twice.
|--------------------------------------------------------------------------
*/
export class BillingEngine {
    private readonly prisma: PrismaClient;
    private readonly d: Dependencies;

    constructor(d: Dependencies) { this.d = d; this.prisma = d.prismaClient; }

    private invalidate(schoolId: string): void { try { this.d.entitlementsService.invalidate(schoolId); } catch { /* cache only */ } }

    private async graceDays(): Promise<number> {
        const s = await this.prisma.platformSettings.findFirst({ select: { subscriptionGracePeriodDays: true } });
        return s?.subscriptionGracePeriodDays ?? DEFAULT_GRACE_DAYS;
    }

    // ── 1. Start a checkout for an open invoice ───────────────────────────
    async startCheckout(p: { invoiceId: string; schoolId: string; payerEmail: string; callbackUrl: string; autoRenew: boolean }) {
        const invoice = await this.prisma.subscriptionInvoice.findFirst({ where: { id: p.invoiceId, schoolId: p.schoolId } });
        const amount = invoice ? invoice.totalKobo - invoice.amountPaidKobo : 0;
        if (!invoice || invoice.status !== "open" || amount <= 0) throw billingErrors.invoiceNotPayable();

        let attempt: { id: string; reference: string } | null = null;
        for (let i = 0; i < 4 && !attempt; i++) {
            const n = (await this.prisma.paymentAttempt.count({ where: { invoiceId: invoice.id } })) + 1 + i;
            try {
                attempt = await this.prisma.paymentAttempt.create({
                    data: { invoiceId: invoice.id, reference: `${invoice.number}-C${n}`, amountKobo: amount, method: "checkout" },
                    select: { id: true, reference: true },
                });
            } catch (err: any) { if (err?.code !== "P2002") throw err; }
        }
        if (!attempt) throw billingErrors.paymentUnavailable();

        try {
            const init = await this.d.paymentProvider.initializeTransaction({
                email: p.payerEmail, amountKobo: amount, reference: attempt.reference, callbackUrl: p.callbackUrl, currency: CURRENCY,
                // NO subaccount: subscription money belongs to the platform, never to the school's settlement account
                metadata: { type: "subscription_invoice", invoiceId: invoice.id, schoolId: p.schoolId, attemptId: attempt.id, autoRenew: p.autoRenew },
            });
            return { authorizationUrl: init.authorizationUrl, reference: attempt.reference, amountKobo: amount };
        } catch (err) {
            await this.prisma.paymentAttempt.update({
                where: { id: attempt.id }, data: { status: "failed", failureReason: (err as Error).message.slice(0, 200), completedAt: new Date() },
            });
            throw billingErrors.paymentUnavailable();
        }
    }

    // ── 2. Charge the saved card for an open invoice (renewals and retries) ─
    async chargeSavedCard(invoiceId: string, now = new Date()): Promise<"skipped" | SettleOutcome> {
        const inv = await this.prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId }, include: { subscription: true } });
        if (!inv || inv.status !== "open") return "skipped";
        const sub = inv.subscription as any;
        if (!sub.autoRenew || !sub.paymentMethodId) { await this.stopAutomatic(inv.id); return "skipped"; }

        const method = await this.prisma.paymentMethod.findFirst({ where: { id: sub.paymentMethodId, removedAt: null } });
        if (!method) { await this.stopAutomatic(inv.id); return "skipped"; }

        const amount = inv.totalKobo - inv.amountPaidKobo;
        if (amount <= 0) return "skipped";
        const n = inv.attemptCount + 1;

        // Claim this attempt number. If another worker already took it, do nothing.
        const claimed = await this.prisma.subscriptionInvoice.updateMany({
            where: { id: inv.id, status: "open", attemptCount: inv.attemptCount }, data: { attemptCount: n, nextAttemptAt: null },
        });
        if (claimed.count === 0) return "skipped";

        const reference = `${inv.number}-A${n}`;
        let attempt;
        try {
            attempt = await this.prisma.paymentAttempt.create({
                data: { invoiceId: inv.id, reference, amountKobo: amount, method: "saved_card", paymentMethodId: method.id },
            });
        } catch (err: any) {
            if (err?.code === "P2002") { await this.reconcile(reference); return "pending"; }    // a crashed run already tried: find out what happened
            throw err;
        }

        try {
            const result = await this.d.paymentProvider.chargeAuthorization({
                customerEmail: method.checkoutEmail, amountKobo: amount, reference, currency: CURRENCY,
                authorizationCode: this.d.encryptionService.decrypt(method.authorizationCode),
                metadata: { type: "subscription_invoice", invoiceId: inv.id, schoolId: inv.schoolId, attemptId: attempt.id },
            });
            return this.settle(attempt.id, result);
        } catch (err) {
            if (err instanceof PaymentProviderError && err.definitive) { await this.failAttempt(attempt.id, err.message); return "failed"; }
            return "pending";      // unknown outcome: the reconciliation job verifies this reference later
        }
    }

    private async stopAutomatic(invoiceId: string): Promise<void> {
        await this.prisma.subscriptionInvoice.update({ where: { id: invoiceId }, data: { nextAttemptAt: null } });
    }

    // ── 3. Reconcile one payment by its reference ─────────────────────────
    async reconcile(reference: string): Promise<{ handled: boolean; outcome?: SettleOutcome | "already_final"; invoiceId?: string; schoolId?: string }> {
        const attempt = await this.prisma.paymentAttempt.findUnique({ where: { reference }, include: { invoice: { select: { schoolId: true } } } });
        if (!attempt) return { handled: false };
        const base = { handled: true, invoiceId: attempt.invoiceId, schoolId: attempt.invoice.schoolId };
        if (attempt.status !== "pending") return { ...base, outcome: "already_final" };

        try {
            const v = await this.d.paymentProvider.verifyTransaction(reference);
            return { ...base, outcome: await this.settle(attempt.id, v) };
        } catch (err) {
            // "not found" for an attempt older than 15 minutes means the provider never saw it: it failed
            if (err instanceof PaymentProviderError && err.definitive && Date.now() - attempt.createdAt.getTime() > 15 * 60_000) {
                await this.failAttempt(attempt.id, "Provider has no record of this payment");
                return { ...base, outcome: "failed" };
            }
            return { ...base, outcome: "pending" };
        }
    }

    // ── 4. Decide what a provider answer means ────────────────────────────
    async settle(attemptId: string, v: VerifyTransactionResult): Promise<SettleOutcome> {
        if (v.status === "pending") return "pending";
        if (v.status === "success") return this.applyPaid(attemptId, v);
        await this.failAttempt(attemptId, v.gatewayResponse ?? v.status, v.status === "abandoned" ? "abandoned" : "failed");
        return "failed";
    }

    // A failed saved-card attempt schedules the next retry (inside the grace period) and tells the school
    async failAttempt(attemptId: string, reason: string, status: "failed" | "abandoned" = "failed"): Promise<void> {
        const attempt = await this.prisma.paymentAttempt.findUnique({ where: { id: attemptId }, include: { invoice: { include: { subscription: true } } } });
        if (!attempt || attempt.status !== "pending") return;
        await this.prisma.paymentAttempt.update({ where: { id: attemptId }, data: { status, failureReason: reason.slice(0, 200), completedAt: new Date() } });

        const inv = attempt.invoice;
        if (attempt.method !== "saved_card" || inv.status !== "open") return;

        const grace   = await this.graceDays();
        const offsets = dunningOffsets(grace);
        const nextOffset = offsets[inv.attemptCount];            // attemptCount is how many attempts were made (this one included)
        const nextAt = nextOffset === undefined ? null : new Date(Math.max(Date.now() + 60 * 60_000, addDays(inv.dueDate, nextOffset).getTime()));
        await this.prisma.subscriptionInvoice.update({ where: { id: inv.id }, data: { lastFailureReason: reason.slice(0, 200), nextAttemptAt: nextAt } });

        const plan = await this.prisma.plan.findUnique({ where: { id: inv.planId }, select: { name: true } });
        await this.d.billingNotifier.send(inv.schoolId, billingMessages.chargeFailed(plan?.name ?? "your", reason.slice(0, 80), nextAt, addDays(inv.dueDate, grace)));
    }

    // ── 5. Apply a verified payment ───────────────────────────────────────
    async applyPaid(attemptId: string, v: VerifyTransactionResult): Promise<SettleOutcome> {
        const holder: { applied: Applied | null; audit: { action: string; schoolId: string; invoiceId: string; meta?: Record<string, unknown> } | null } = { applied: null, audit: null };

        const outcome = await this.prisma.$transaction(async (tx): Promise<SettleOutcome> => {
            const first = await tx.paymentAttempt.findUnique({ where: { id: attemptId } });
            if (!first) return "ignored";
            await tx.$queryRaw`SELECT id FROM "SubscriptionInvoice" WHERE id = ${first.invoiceId} FOR UPDATE`;

            const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
            if (attempt.status === "success") return "duplicate";
            const inv = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: attempt.invoiceId }, include: { subscription: true } });

            if (v.amountKobo !== attempt.amountKobo || (v.currency && v.currency !== CURRENCY)) {
                await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: "failed", failureReason: "amount_mismatch", completedAt: new Date() } });
                holder.audit = { action: "billing.amount_mismatch", schoolId: inv.schoolId, invoiceId: inv.id, meta: { expected: attempt.amountKobo, received: v.amountKobo, currency: v.currency } };
                return "mismatch";
            }

            await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: "success", providerStatus: v.status, completedAt: new Date() } });

            if (inv.status === "paid") {
                holder.audit = { action: "billing.duplicate_payment", schoolId: inv.schoolId, invoiceId: inv.id, meta: { reference: attempt.reference, amountKobo: attempt.amountKobo } };
                return "duplicate";
            }
            if (inv.status === "void") {
                holder.audit = { action: "billing.payment_on_void_invoice", schoolId: inv.schoolId, invoiceId: inv.id, meta: { reference: attempt.reference, amountKobo: attempt.amountKobo } };
                return "paid_on_void";
            }
            holder.applied = await this.applyInvoice(tx, inv, { card: v.reusable ? v : null, autoRenewIntent: v.metadata?.autoRenew === true });
            return "paid";
        }, { timeout: 20_000, maxWait: 10_000 });

        await this.afterCommit(holder.applied, holder.audit, { reference: undefined });
        return outcome;
    }

    /** Zero-value invoices (a credit covers everything, or a complimentary change): applied at once, no payment. */
    async applyWithoutPayment(invoiceId: string, actorId: string, note: string): Promise<void> {
        const holder: { applied: Applied | null } = { applied: null };
        await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "SubscriptionInvoice" WHERE id = ${invoiceId} FOR UPDATE`;
            const inv = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { subscription: true } });
            if (inv.status !== "open" || inv.totalKobo !== 0) throw billingErrors.invoiceNotPayable();
            holder.applied = await this.applyInvoice(tx, inv, { card: null, autoRenewIntent: false });
        });
        await this.afterCommit(holder.applied, { action: "billing.invoice_applied_without_payment", schoolId: holder.applied!.schoolId, invoiceId, meta: { note } }, { actorId });
    }

    /** A platform person confirms an offline payment (bank transfer). Recorded as a manual attempt with their reference. */
    async markPaidManually(invoiceId: string, actorId: string, reference: string, note?: string): Promise<void> {
        const holder: { applied: Applied | null } = { applied: null };
        await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "SubscriptionInvoice" WHERE id = ${invoiceId} FOR UPDATE`;
            const inv = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { subscription: true } });
            if (inv.status !== "open" && inv.status !== "uncollectible") throw billingErrors.invoiceSettled();
            try {
                await tx.paymentAttempt.create({
                    data: { invoiceId, reference: `MANUAL-${reference}`, amountKobo: inv.totalKobo, status: "success", method: "manual", completedAt: new Date(), providerStatus: "manual" },
                });
            } catch (err: any) { if (err?.code === "P2002") throw billingErrors.invoiceSettled(); throw err; }   // this reference was already used
            holder.applied = await this.applyInvoice(tx, inv, { card: null, autoRenewIntent: false });
        });
        await this.afterCommit(holder.applied, { action: "billing.invoice_marked_paid", schoolId: holder.applied!.schoolId, invoiceId, meta: { reference, note } }, { actorId });
    }

    async voidInvoice(invoiceId: string, actorId: string, reason: string): Promise<void> {
        const res = await this.prisma.subscriptionInvoice.updateMany({
            where: { id: invoiceId, status: "open" }, data: { status: "void", voidedAt: new Date(), nextAttemptAt: null, note: reason },
        });
        if (res.count === 0) throw billingErrors.invoiceSettled();
        const inv = await this.prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { schoolId: true } });
        await this.d.auditService.log({ userId: actorId, schoolId: inv.schoolId, action: "billing.invoice_voided", entity: "SubscriptionInvoice", entityId: invoiceId, metadata: { reason } });
    }

    // ── The one place an invoice becomes subscription state (inside a transaction, invoice row locked) ──
    private async applyInvoice(
        tx: Prisma.TransactionClient,
        inv: any,
        opts: { card: VerifyTransactionResult | null; autoRenewIntent: boolean },
    ): Promise<Applied> {
        const sub = inv.subscription;
        const now = new Date();

        // A period that keeps its renewal date keeps its anchor day; a new period anchors on its start day
        const keepsAnchor = !(inv.reason === "upgrade" && inv.periodStart.getTime() !== sub.currentPeriodStart.getTime());
        const anchor = keepsAnchor ? (sub.billingAnchorDay ?? 1) : inv.periodStart.getUTCDate();

        let methodId: string | null = sub.paymentMethodId ?? null;
        let cardSaved = false;
        const c = opts.card;
        if (c && c.authorizationCode && c.channel === "card") {
            const enc = this.d.encryptionService.encrypt(c.authorizationCode);
            const fields = {
                authorizationCode: enc, brand: c.cardBrand ?? null, last4: c.cardLast4 ?? null, expMonth: c.cardExpMonth ?? null,
                expYear: c.cardExpYear ?? null, bank: c.cardBank ?? null, checkoutEmail: c.customerEmail, isDefault: true, removedAt: null,
            };
            const sig = c.authorizationSignature ?? null;
            const existing = sig ? await tx.paymentMethod.findFirst({ where: { schoolId: sub.schoolId, signature: sig } }) : null;
            await tx.paymentMethod.updateMany({ where: { schoolId: sub.schoolId, removedAt: null }, data: { isDefault: false } });
            const m = existing
                ? await tx.paymentMethod.update({ where: { id: existing.id }, data: fields })
                : await tx.paymentMethod.create({ data: { schoolId: sub.schoolId, signature: sig, ...fields } });
            methodId = m.id; cardSaved = true;
        }

        const data: Record<string, unknown> = {
            planId: inv.planId, billingCycle: inv.billingCycle, status: "active",
            currentPeriodStart: inv.periodStart, currentPeriodEnd: inv.periodEnd, nextBillingDate: inv.periodEnd,
            trialEndsAt: null, failedBillingCount: 0, lapsedPlanId: null, cancelAtPeriodEnd: false,
            billingAnchorDay: anchor, paymentMethodId: methodId, couponId: inv.couponId ?? sub.couponId ?? null,
        };
        if (sub.scheduledDowngradePlanId && (inv.planId === sub.scheduledDowngradePlanId || inv.reason === "upgrade")) data.scheduledDowngradePlanId = null;
        if (opts.autoRenewIntent && methodId) data.autoRenew = true;
        await tx.subscription.update({ where: { id: sub.id }, data: data as never });

        await tx.subscriptionInvoice.update({
            where: { id: inv.id },
            data: { status: "paid", amountPaidKobo: inv.totalKobo, paidAt: now, nextAttemptAt: null, lastFailureReason: null },
        });
        if (inv.reason !== "renewal") {
            await tx.subscriptionInvoice.updateMany({
                where: { subscriptionId: sub.id, status: "open", id: { not: inv.id } },
                data: { status: "void", voidedAt: now, nextAttemptAt: null, note: "Replaced by a newer payment" },
            });
        }
        if (inv.couponId) {
            await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE id = ${inv.couponId} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
        }
        return { schoolId: inv.schoolId, planId: inv.planId, periodEnd: inv.periodEnd, totalKobo: inv.totalKobo, reason: inv.reason, invoiceId: inv.id, cardSaved };
    }

    // Audit, notify and refresh the entitlement cache. Only after the database change is committed.
    private async afterCommit(
        applied: Applied | null,
        audit: { action: string; schoolId: string; invoiceId: string; meta?: Record<string, unknown> } | null,
        ctx: { actorId?: string; reference?: string },
    ): Promise<void> {
        const base = ctx.actorId ? { userId: ctx.actorId } : { actorType: ActorType.SYSTEM };
        if (audit) {
            await this.d.auditService.log({ ...base, schoolId: audit.schoolId, action: audit.action, entity: "SubscriptionInvoice", entityId: audit.invoiceId, metadata: audit.meta });
        }
        if (!applied) return;
        this.invalidate(applied.schoolId);
        await this.d.auditService.log({
            ...base, schoolId: applied.schoolId, action: "billing.invoice_paid", entity: "SubscriptionInvoice", entityId: applied.invoiceId,
            metadata: { reason: applied.reason, totalKobo: applied.totalKobo, planId: applied.planId, cardSaved: applied.cardSaved },
        });
        const plan = await this.prisma.plan.findUnique({ where: { id: applied.planId }, select: { name: true } });
        await this.d.billingNotifier.send(applied.schoolId,
            applied.totalKobo > 0 ? billingMessages.paid(plan?.name ?? "", applied.periodEnd, applied.totalKobo) : billingMessages.changed(plan?.name ?? ""));
    }
}
