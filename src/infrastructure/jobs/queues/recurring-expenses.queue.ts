import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| RECURRING EXPENSES QUEUE: one repeating job, every day at 05:00 Lagos time. Call scheduleRecurringExpenses() once at start-up
| (it updates the schedule, it never duplicates it). Safe to run twice: the database allows one expense per repeating template per day.
*/
export const recurringExpensesQueue = new Queue("recurring-expenses", { connection: redisConnection });

export async function scheduleRecurringExpenses(): Promise<void> {
    await recurringExpensesQueue.upsertJobScheduler(
        "recurring-expenses-daily",
        { pattern: "0 5 * * *", tz: "Africa/Lagos" },
        { name: "run", opts: { removeOnComplete: 20, removeOnFail: 50, attempts: 2 } },
    );
}
