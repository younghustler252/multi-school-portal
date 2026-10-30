import { Queue }            from "bullmq";
import { redisConnection }  from "../connection";

/*
|--------------------------------------------------------------------------
| NOTIFICATION QUEUE
| One job per message to deliver by email or SMS (in-app messages need no delivery step). The job only names the row;
| the worker re-reads it, so the text and the contact are always the current ones. The job id is the row id, so adding
| the same row twice never sends twice. Three tries with growing waits; the row records the final failure.
|--------------------------------------------------------------------------
*/
export interface NotificationDeliveryJob {
    kind:         "school" | "platform";
    recipientId:  string;
    schoolId:     string;
    /** The school's database schema (school messages only). */
    tenantSchema: string;
}

export const notificationQueue = new Queue<NotificationDeliveryJob>(
    "notification",
    { connection: redisConnection },
);

export async function enqueueDeliveries(jobs: NotificationDeliveryJob[]): Promise<void> {
    if (jobs.length === 0) return;
    await notificationQueue.addBulk(jobs.map(data => ({
        name: "deliver",
        data,
        opts: {
            jobId:            `deliver_${data.kind}_${data.recipientId}`,
            attempts:         3,
            backoff:          { type: "exponential" as const, delay: 3000 },
            removeOnComplete: 1000,
            removeOnFail:     5000,
        },
    })));
}
