import { Worker } from "bullmq";
import { redisConnection } from "../connection";

import {
    prisma,
    getTenantClient,
} from "../../database/prisma/prisma.client";

import { TenantContext } from "../../database/prisma/tenant.context";

import { container } from "../../../container";
import { VerifyPaymentUseCase } from "../../../modules/payments/usecases/verify-payment.usecase";
import { VerifySubscriptionUpgradeUseCase } from "../../../modules/subscriptions/usecases/school-admin/verify-subscription-upgrade";

export const paymentReconciliationWorker = new Worker(
    "payment-reconciliation",
    async () => {

        const verifyPaymentUseCase =
            container.resolve<VerifyPaymentUseCase>("verifyPaymentUseCase");

        const verifySubscriptionUpgradeUseCase =
            container.resolve<VerifySubscriptionUpgradeUseCase>(
                "verifySubscriptionUpgradeUseCase"
            );

        // ─────────────────────────────────────────────────────────────
        // PUBLIC: Get schools that have tenant schemas
        // ─────────────────────────────────────────────────────────────

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

        // ─────────────────────────────────────────────────────────────
        // TENANT: Reconcile stale fee payments
        // ─────────────────────────────────────────────────────────────

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
                                    status: "pending",
                                    createdAt: {
                                        lt: new Date(
                                            Date.now() - 15 * 60 * 1000
                                        ),
                                    },
                                },
                            });

                        for (const payment of staleFeePayments) {
                            if (!payment.reference) continue;

                            try {
                                await verifyPaymentUseCase.execute({
                                    reference: payment.reference,
                                });

                                console.log(
                                    `🔁 Reconciled fee payment: ${payment.reference} ` +
                                    `(school: ${school.id})`
                                );
                            } catch (err) {
                                console.error(
                                    `⚠️ Reconciliation failed for ${payment.reference} ` +
                                    `(school: ${school.id}):`,
                                    err
                                );
                            }
                        }
                    }
                );
            } catch (err) {
                console.error(
                    `⚠️ Failed to reconcile tenant ${school.schemaName} ` +
                    `(school: ${school.id}):`,
                    err
                );
            }
        }

        // ─────────────────────────────────────────────────────────────
        // PUBLIC: Reconcile stale subscription payments
        // ─────────────────────────────────────────────────────────────

        const staleBilling = await prisma.billingHistory.findMany({
            where: {
                status: "pending",
                createdAt: {
                    lt: new Date(Date.now() - 15 * 60 * 1000),
                },
            },
        });

        for (const billing of staleBilling) {
            if (!billing.paystackReference) continue;

            try {
                await verifySubscriptionUpgradeUseCase.execute(
                    billing.paystackReference
                );

                console.log(
                    `🔁 Reconciled subscription payment: ${billing.paystackReference}`
                );
            } catch (err) {
                console.error(
                    `⚠️ Reconciliation failed for ${billing.paystackReference}:`,
                    err
                );
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 1,
    }
);
