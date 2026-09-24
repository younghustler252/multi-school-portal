import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
|--------------------------------------------------------------------------
| PAYMENT RECONCILIATION QUEUE
|--------------------------------------------------------------------------
*/

export interface PaymentReconciliationJobData {
    runAt: string;
}

export const paymentReconciliationQueue =
    new Queue<PaymentReconciliationJobData>(
        "payment-reconciliation",
        {
            connection: redisConnection,
        },
    );
