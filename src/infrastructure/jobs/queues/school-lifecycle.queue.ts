import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| SCHOOL LIFECYCLE QUEUE: one repeating job, once a day at 03:00 Lagos time.
| Call scheduleSchoolLifecycle() once at worker start-up (it is safe to call on every start:
| the scheduler is upserted, not duplicated). Needs BullMQ 5.16 or newer (upsertJobScheduler).
*/
export const schoolLifecycleQueue = new Queue("school-lifecycle", { connection: redisConnection });

export async function scheduleSchoolLifecycle(): Promise<void> {
    await schoolLifecycleQueue.upsertJobScheduler(
        "school-lifecycle-daily",
        { pattern: "0 3 * * *", tz: "Africa/Lagos" },
        { name: "run", opts: { removeOnComplete: 20, removeOnFail: 50, attempts: 2 } },
    );
}
