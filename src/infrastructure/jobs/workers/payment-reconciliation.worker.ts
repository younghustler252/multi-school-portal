import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { prisma, getTenantClient } from "../../database/prisma/prisma.client";
import { TenantContext } from "../../database/prisma/tenant.context";
import { container } from "../../../container";
import { ConfirmOnlinePaymentUseCase } from "../../../modules/payments/usecases/online-payment.usecases";
import { BillingEngine } from "../../../../billing-module-v1 (1)/modules/subscriptions/services/billing-engine.service";

/*
| PAYMENT RECONCILIATION: a safety net for payments whose webhook or return visit never arrived.
|  - school FEE payments still pending after 15 minutes are re-verified inside their school (unchanged)
|  - SUBSCRIPTION payments: pending attempts older than 15 minutes are re-verified through the billing engine
|    (the old version looked at the billing-history table, which no longer exists as the source of truth).
|    The hourly billing job does the same; this job exists so the check can also run more often.
*/
export const paymentReconciliationWorker = new Worker(
    "payment-reconciliation",
    async () => {
        const confirmOnlinePayment = container.resolve<ConfirmOnlinePaymentUseCase>("confirmOnlinePaymentUseCase");
        const billingEngine        = container.resolve<BillingEngine>("billingEngine");
        const cutoff = new Date(Date.now() - 15 * 60 * 1000);

        // ── School fee payments (inside each school's own schema) ──
        const schools = await prisma.school.findMany({
            where: { isActive: true, schemaName: { not: null }, schemaProvisionedAt: { not: null } },
            select: { id: true, schemaName: true },
        });

        for (const school of schools) {
            if (!school.schemaName) continue;
            try {
                await TenantContext.run({ schoolId: school.id, tenantSchema: school.schemaName }, async () => {
                    const stale = await getTenantClient().payment.findMany({ where: { status: "PENDING", method: "paystack", createdAt: { lt: cutoff } } });
                    for (const payment of stale) {
                        if (!payment.reference) continue;
                        try {
                            await confirmOnlinePayment.execute(payment.reference, school.id);
                            console.log(`🔁 Reconciled fee payment: ${payment.reference} (school: ${school.id})`);
                        } catch (err) {
                            console.error(`⚠️ Reconciliation failed for ${payment.reference} (school: ${school.id}):`, err);
                        }
                    }
                });
            } catch (err) {
                console.error(`⚠️ Failed to reconcile tenant ${school.schemaName} (school: ${school.id}):`, err);
            }
        }

        // ── Subscription payments ──
        const pending = await prisma.paymentAttempt.findMany({
            where: { status: "pending", method: { not: "manual" }, createdAt: { lt: cutoff } },
            orderBy: { createdAt: "asc" }, take: 200, select: { reference: true },
        });
        for (const a of pending) {
            try {
                await billingEngine.reconcile(a.reference);
                console.log(`🔁 Reconciled subscription payment: ${a.reference}`);
            } catch (err) {
                console.error(`⚠️ Reconciliation failed for ${a.reference}:`, err);
            }
        }
    },
    { connection: redisConnection, concurrency: 1 },
);
