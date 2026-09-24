import { defaulterReminderQueue } from "../queues/defaulter-reminder.queue";

/*
|--------------------------------------------------------------------------
| DEFAULTER REMINDER SCHEDULER
|--------------------------------------------------------------------------
| Runs every day at 8:00 AM.
|--------------------------------------------------------------------------
*/

export const scheduleDefaulterReminder =
    async (): Promise<void> => {
        await defaulterReminderQueue.upsertJobScheduler(
            "defaulter-reminder-scheduler",
            {
                pattern: "0 8 * * *",
            },
            {
                name: "daily-check",
                data: {
                    runAt: new Date().toISOString(),
                },
                opts: {
                    removeOnComplete: true,
                    removeOnFail: false,
                },
            },
        );

        console.log(
            "⏰ Defaulter reminder scheduled — every day at 8:00 AM",
        );
    };