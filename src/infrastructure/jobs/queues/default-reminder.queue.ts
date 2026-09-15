import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
|--------------------------------------------------------------------------
| DEFAULTER REMINDER QUEUE
| Runs every day at 8:00 AM
|--------------------------------------------------------------------------
*/

export interface DefaulterReminderJobData {
    // Add data here later if needed
}

export const defaulterReminderQueue =
    new Queue<DefaulterReminderJobData>(
        "defaulter-reminder",
        {
            connection: redisConnection,
        },
    );

export const addDefaulterReminderJob = async (): Promise<void> => {
    await defaulterReminderQueue.add(
        "daily-check",
        {},
        {
            repeat: {
                pattern: "0 8 * * *",
            },
            removeOnComplete: true,
            removeOnFail: false,
        },
    );
};
