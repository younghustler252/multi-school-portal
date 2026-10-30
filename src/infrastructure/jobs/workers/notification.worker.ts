import { Worker, Job } from "bullmq";
import * as Sentry from "@sentry/node";
import { redisConnection } from "../connection";
import { NotificationDeliveryJob } from "../queues/notification.queue";
import { TenantContext } from "../../database/prisma/tenant.context";
import { container } from "../../../container";
import type { NotificationDeliveryService } from "../../../modules/notifications/services/notification-delivery.service";

/*
|--------------------------------------------------------------------------
| NOTIFICATION DELIVERY WORKER
| Sends one email or SMS (the job names the recipient row). Runs inside the school's own database context.
| A failed delivery throws so the queue tries again (3 tries); a message that can never be delivered (no contact on
| file) is recorded and NOT retried. The row keeps the outcome either way.
| (This file used to be a copy of the payment reconciliation worker, listening on that queue by mistake.)
|--------------------------------------------------------------------------
*/
export const notificationWorker = new Worker<NotificationDeliveryJob>(
    "notification",
    async (job: Job<NotificationDeliveryJob>) => {
        const { kind, recipientId, schoolId, tenantSchema } = job.data;

        const deliver = async () => {
            const service = container.createScope().resolve<NotificationDeliveryService>("notificationDeliveryService");
            return kind === "school" ? service.deliverSchoolRecipient(recipientId) : service.deliverPlatformRecipient(recipientId);
        };

        const result = kind === "school"
            ? await TenantContext.run({ tenantSchema, schoolId }, deliver)
            : await deliver();

        if (result.outcome === "failed") throw new Error(result.reason ?? "Delivery failed");
        return result;
    },
    { connection: redisConnection, concurrency: 5 },
);

notificationWorker.on("failed", (job, err) => {
    const finalTry = !!job && job.attemptsMade >= (job.opts.attempts ?? 1);
    console.error(`❌ Notification ${job?.id} failed (try ${job?.attemptsMade}):`, err.message);
    if (finalTry) Sentry.captureException(err, { extra: { jobId: job?.id, recipientId: job?.data.recipientId, schoolId: job?.data.schoolId } });
});
notificationWorker.on("error", err => console.error("❌ Notification worker error:", err.message));
