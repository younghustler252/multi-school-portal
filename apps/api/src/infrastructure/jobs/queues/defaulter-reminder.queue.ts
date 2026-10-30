import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
|--------------------------------------------------------------------------
| DEFAULTER REMINDER QUEUE
|--------------------------------------------------------------------------
| Processes daily fee reminder checks.
|--------------------------------------------------------------------------
*/

export interface DefaulterReminderJobData {
    runAt: string;
}

export const defaulterReminderQueue =
    new Queue<DefaulterReminderJobData>(
        "defaulter-reminder",
        {
            connection: redisConnection,
        },
    );