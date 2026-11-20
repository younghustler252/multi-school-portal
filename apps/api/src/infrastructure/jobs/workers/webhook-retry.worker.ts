import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { AutoRetryWebhooksUseCase } from "../../../modules/webhooks/usecases/auto-retry.usecase";

export const webhookRetryWorker = new Worker(
    "webhook-retry",
    async () => {
        const scope = container.createScope();
        const summary = await scope.resolve<AutoRetryWebhooksUseCase>("autoRetryWebhooksUseCase").execute();
        if (summary.tried || summary.dead) console.log("🔁 Webhook auto-retry:", JSON.stringify(summary));
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

webhookRetryWorker.on("failed", (job, err) => { console.error(`❌ Webhook retry job ${job?.id} failed:`, err.message); Sentry.captureException(err, { extra: { jobId: job?.id } }); });
webhookRetryWorker.on("error", err => console.error("❌ Webhook retry worker error:", err.message));
