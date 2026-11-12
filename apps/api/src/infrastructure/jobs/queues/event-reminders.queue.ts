import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| EVENT REMINDERS QUEUE: one repeating job every 5 minutes. Each tick looks at every school's due reminders
| (calendar_event reminders whose time has come) and sends them, so a reminder due at 08:00 goes out between 08:00 and 08:05.
| A tick that finds nothing due does almost nothing. Call scheduleEventReminderTick() once at start-up (it updates the schedule, never duplicates it).
*/
export const eventRemindersQueue = new Queue("event-reminders", { connection: redisConnection });

export async function scheduleEventReminderTick(): Promise<void> {
    await eventRemindersQueue.upsertJobScheduler(
        "event-reminders-tick",
        { pattern: "*/5 * * * *", tz: "Africa/Lagos" },
        { name: "tick", opts: { removeOnComplete: 20, removeOnFail: 50 } },
    );
}
