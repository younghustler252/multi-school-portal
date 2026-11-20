import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| WEBHOOK RETRY QUEUE (REM-103): one repeating job, every minute. It retries FAILED webhook events whose back-off has passed
| (see AutoRetryWebhooksUseCase). Running it twice at once is safe: every retry first takes the event's lease.
*/
export const webhookRetryQueue = new Queue("webhook-retry", { connection: redisConnection });

export async function scheduleWebhookRetry(): Promise<void> {
    await webhookRetryQueue.upsertJobScheduler(
        "webhook-auto-retry",
        { every: 60_000 },
        { name: "run", opts: { removeOnComplete: 20, removeOnFail: 50, attempts: 1 } },
    );
}
