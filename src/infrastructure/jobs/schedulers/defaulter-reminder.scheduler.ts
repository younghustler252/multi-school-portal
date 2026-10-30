import { defaulterReminderQueue } from "../queues/defaulter-reminder.queue";

/*
| The old fixed 08:00 fee reminder is replaced by the automation engine (rule "fee.reminder_due_soon", on by default, same time).
| Earlier versions registered a repeating job in Redis; this removes it once so the reminder is not sent twice.
| Removing a scheduler that is not there is harmless.
*/
export const retireDefaulterReminder = async (): Promise<void> => {
    await defaulterReminderQueue.removeJobScheduler("defaulter-reminder-scheduler");
};
