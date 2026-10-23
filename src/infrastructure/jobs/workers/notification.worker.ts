import { Worker, Job } from "bullmq";
import * as Sentry from "@sentry/node";

import { redisConnection } from "../connection";
import { PaymentReconciliationJobData } from "../queues/payment-reconciliation.queue";

import {
    prisma,
    getTenantClient,
} from "../../database/prisma/prisma.client";

import { TenantContext } from "../../database/prisma/tenant.context";

import { container } from "../../../container";
import { ConfirmOnlinePaymentUseCase } from "../../../modules/payments/usecases/online-payment.usecases";
import { VerifySubscriptionUpgradeUseCase } from "../../../modules/subscriptions/usecases/school-admin/verify-subscription-upgrade";

/*
|--------------------------------------------------------------------------
| PAYMENT RECONCILIATION WORKER
| Periodically checks for stale pending payments and attempts verification.
|--------------------------------------------------------------------------
*/

export const paymentReconciliationWorker =
    new Worker<PaymentReconciliationJobData>(
        "payment-reconciliation",

        async (job: Job<PaymentReconciliationJobData>) => {
            console.log(
                `💳 Processing payment reconciliation job: ${job.id}`,
            );

            const confirmOnlinePayment =
                container.resolve<ConfirmOnlinePaymentUseCase>(
                    "confirmOnlinePaymentUseCase",
                );

            const verifySubscriptionUpgradeUseCase =
                container.resolve<VerifySubscriptionUpgradeUseCase>(
                    "verifySubscriptionUpgradeUseCase",
                );

            const staleBefore = new Date(
                Date.now() - 15 * 60 * 1000,
            );

            // ─────────────────────────────────────────────────────────
            // PUBLIC: Get schools that have tenant schemas
            // ─────────────────────────────────────────────────────────

            const schools = await prisma.school.findMany({
                where: {
                    isActive: true,
                    schemaName: {
                        not: null,
                    },
                },
                select: {
                    id: true,
                    schemaName: true,
                },
            });

            console.log(
                `🏫 Checking ${schools.length} active tenant(s) for stale payments`,
            );

            // ─────────────────────────────────────────────────────────
            // TENANT: Reconcile stale fee payments
            // ─────────────────────────────────────────────────────────

            for (const school of schools) {
                if (!school.schemaName) continue;

                try {
                    await TenantContext.run(
                        {
                            schoolId: school.id,
                            tenantSchema: school.schemaName,
                        },
                        async () => {
                            const tenantPrisma = getTenantClient();

                            const staleFeePayments =
                                await tenantPrisma.payment.findMany({
                                    where: {
                                        status: "PENDING",
                                        method: "paystack",
                                        createdAt: {
                                            lt: staleBefore,
                                        },
                                    },
                                });

                            if (staleFeePayments.length === 0) {
                                return;
                            }

                            console.log(
                                `💰 Found ${staleFeePayments.length} stale fee payment(s) ` +
                                `for school ${school.id}`,
                            );

                            for (const payment of staleFeePayments) {
                                if (!payment.reference) continue;

                                try {
                                    await confirmOnlinePayment.execute(
                                        payment.reference,
                                        school.id,
                                    );

                                    console.log(
                                        `🔁 Reconciled fee payment: ${payment.reference} ` +
                                        `(school: ${school.id})`,
                                    );
                                } catch (err) {
                                    console.error(
                                        `⚠️ Reconciliation failed for ${payment.reference} ` +
                                        `(school: ${school.id}):`,
                                        err,
                                    );

                                    Sentry.captureException(err, {
                                        extra: {
                                            jobId: job.id,
                                            jobName: job.name,
                                            paymentReference:
                                                payment.reference,
                                            schoolId: school.id,
                                            tenantSchema:
                                                school.schemaName,
                                            paymentType: "fee",
                                        },
                                    });
                                }
                            }
                        },
                    );
                } catch (err) {
                    console.error(
                        `⚠️ Failed to reconcile tenant ${school.schemaName} ` +
                        `(school: ${school.id}):`,
                        err,
                    );

                    Sentry.captureException(err, {
                        extra: {
                            jobId: job.id,
                            jobName: job.name,
                            schoolId: school.id,
                            tenantSchema: school.schemaName,
                            paymentType: "tenant",
                        },
                    });
                }
            }

            // ─────────────────────────────────────────────────────────
            // PUBLIC: Reconcile stale subscription payments
            // ─────────────────────────────────────────────────────────

            const staleBilling =
                await prisma.billingHistory.findMany({
                    where: {
                        status: "pending",
                        createdAt: {
                            lt: staleBefore,
                        },
                    },
                });

            console.log(
                `📦 Found ${staleBilling.length} stale subscription payment(s)`,
            );

            for (const billing of staleBilling) {
                if (!billing.paystackReference) continue;

                try {
                    await verifySubscriptionUpgradeUseCase.execute(
                        billing.paystackReference,
                    );

                    console.log(
                        `🔁 Reconciled subscription payment: ${billing.paystackReference}`,
                    );
                } catch (err) {
                    console.error(
                        `⚠️ Reconciliation failed for ${billing.paystackReference}:`,
                        err,
                    );

                    Sentry.captureException(err, {
                        extra: {
                            jobId: job.id,
                            jobName: job.name,
                            paymentReference:
                                billing.paystackReference,
                            billingId: billing.id,
                            paymentType: "subscription",
                        },
                    });
                }
            }

            return {
                schoolsChecked: schools.length,
                staleSubscriptions: staleBilling.length,
                completedAt: new Date().toISOString(),
            };
        },

        {
            connection: redisConnection,
            concurrency: 1,
        },
    );

/*
|--------------------------------------------------------------------------
| WORKER EVENTS
|--------------------------------------------------------------------------
*/

paymentReconciliationWorker.on("completed", (job) => {
    console.log(
        `✅ Payment reconciliation job ${job.id} completed`,
    );
});

paymentReconciliationWorker.on("failed", (job, err) => {
    console.error(
        `❌ Payment reconciliation job ${job?.id} failed:`,
        err.message,
    );

    Sentry.captureException(err, {
        extra: {
            jobId: job?.id,
            jobName: job?.name,
        },
    });
});