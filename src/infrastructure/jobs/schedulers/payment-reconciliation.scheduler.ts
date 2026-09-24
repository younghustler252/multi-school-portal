import { paymentReconciliationQueue } from "../queues/payment-reconciliation.queue";

/*
|--------------------------------------------------------------------------
| PAYMENT RECONCILIATION SCHEDULER
| Periodically checks for stale pending payments.
|--------------------------------------------------------------------------
*/

export const schedulePaymentReconciliation =
    async (): Promise<void> => {
        await paymentReconciliationQueue.upsertJobScheduler(
            "payment-reconciliation-scheduler",
            {
                every: 60 * 1000,
            },
            {
                name: "reconcile",
                data: {
                    runAt: new Date().toISOString(),
                },
                opts: {
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            },
        );

        console.log(
            "⏰ Payment reconciliation scheduled — every 1 minute",
        );
    };
