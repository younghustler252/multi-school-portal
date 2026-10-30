import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| AUTOMATION QUEUE: one repeating job every 5 minutes. Each tick looks at every school and runs the rules whose time has come,
| so a rule set for 08:00 runs between 08:00 and 08:05 Lagos time. A tick that finds nothing due does almost nothing.
| Call scheduleAutomationTick() once at start-up (it updates the schedule, it never duplicates it).
*/
export const automationQueue = new Queue("automation", { connection: redisConnection });

export async function scheduleAutomationTick(): Promise<void> {
    await automationQueue.upsertJobScheduler(
        "automation-tick",
        { pattern: "*/5 * * * *", tz: "Africa/Lagos" },
        { name: "tick", opts: { removeOnComplete: 20, removeOnFail: 50 } },
    );
}
