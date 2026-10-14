import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| BILLING QUEUE: one repeating job, every hour at minute 5. It replaces the old "subscription-expiry" job
| (remove that queue, its worker and its scheduler registration). Every step of the job is safe to run twice.
| Call scheduleBilling() once when the workers start (it updates the schedule, it never duplicates it).
| Needs BullMQ 5.16 or newer (upsertJobScheduler).
*/
export const billingQueue = new Queue("billing", { connection: redisConnection });

export async function scheduleBilling(): Promise<void> {
    await billingQueue.upsertJobScheduler(
        "billing-hourly",
        { pattern: "5 * * * *", tz: "Africa/Lagos" },
        { name: "run", opts: { removeOnComplete: 24, removeOnFail: 100, attempts: 1 } },
    );
}
