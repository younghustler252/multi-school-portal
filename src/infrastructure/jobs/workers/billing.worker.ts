import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { BillingLifecycleService } from "../../../../billing-module-v1 (1)/modules/subscriptions/services/billing-lifecycle.service";

export const billingWorker = new Worker(
    "billing",
    async () => {
        const lifecycle = container.createScope().resolve<BillingLifecycleService>("billingLifecycleService");
        const summary = await lifecycle.run();
        console.log("💳 Billing run:", summary);
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

billingWorker.on("failed", (job, err) => {
    console.error(`❌ Billing job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id } });
});
billingWorker.on("error", err => console.error("❌ Billing worker error:", err.message));
