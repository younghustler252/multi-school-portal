import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| TERM LIFECYCLE QUEUE: one repeating job, every morning at 07:00 Lagos time. It reminds each school when its current term is about
| to end and when it has ended. Call scheduleTermLifecycle() once at start-up (it updates the schedule, it never duplicates it).
*/
export const termLifecycleQueue = new Queue("term-lifecycle", { connection: redisConnection });

export async function scheduleTermLifecycle(): Promise<void> {
    await termLifecycleQueue.upsertJobScheduler(
        "term-lifecycle-daily",
        { pattern: "0 7 * * *", tz: "Africa/Lagos" },
        { name: "run", opts: { removeOnComplete: 20, removeOnFail: 50 } },
    );
}
