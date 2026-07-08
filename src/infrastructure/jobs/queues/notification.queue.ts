import { Queue }            from "bullmq";
import { redisConnection }  from "../connection";

/*
|--------------------------------------------------------------------------
| NOTIFICATION QUEUE
| Sends email/SMS notifications asynchronously
| Used by: OTP, invites, fee reminders, report card alerts, broadcasts
|--------------------------------------------------------------------------
*/

export interface NotificationJobData {
    channel:  "email" | "sms";
    to:       string | string[];
    type:     string;                    // e.g. "otp", "invite", "fee_reminder"
    payload:  Record<string, any>;
}

export const notificationQueue = new Queue<NotificationJobData>(
    "notification",
    { connection: redisConnection },
);

export const addNotificationJob = async (
    data: NotificationJobData,
): Promise<void> => {
    await notificationQueue.add("send", data, {
        attempts:    3,
        backoff: {
            type:  "exponential",
            delay: 3000,
        },
        removeOnComplete: true,
        removeOnFail:     false,
    });
};