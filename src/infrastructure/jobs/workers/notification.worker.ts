import { Worker, Job }          from "bullmq";
import { redisConnection }      from "../connection";
import { NotificationJobData }  from "../queues/notification.queue";
import { MailService }          from "../../mail/mail.service";
import { SmsService }           from "../../sms/sms.service";

/*
|--------------------------------------------------------------------------
| NOTIFICATION WORKER
| Processes queued email/SMS sends
|--------------------------------------------------------------------------
*/

const mailService = new MailService();
const smsService   = new SmsService();

export const notificationWorker = new Worker<NotificationJobData>(
    "notification",
    async (job: Job<NotificationJobData>) => {
        const { channel, to, type, payload } = job.data;

        console.log(`📨 Processing ${channel} notification: ${type}`);

        if (channel === "email") {
            if (type === "otp") {
                await mailService.sendOtp(to as string, payload as any);
            } else {
                await mailService.sendLetter(to, payload as any);
            }
        }

        if (channel === "sms") {
            await smsService.send({
                to,
                message: payload.message,
            });
        }

        return { status: "sent" };
    },
    { connection: redisConnection, concurrency: 5 },
);

notificationWorker.on("completed", (job) => {
    console.log(`✅ Notification job ${job.id} completed`);
});

notificationWorker.on("failed", (job, err) => {
    console.error(`❌ Notification job ${job?.id} failed:`, err.message);
});