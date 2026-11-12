import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { RunEventRemindersForAllSchoolsUseCase } from "../../../modules/events/usecases/event-reminders.usecases";

export const eventRemindersWorker = new Worker(
    "event-reminders",
    async () => {
        const summary = await container.createScope().resolve<RunEventRemindersForAllSchoolsUseCase>("runEventRemindersForAllSchoolsUseCase").execute();
        if (summary.crashed.length || summary.failed) {
            console.error("❌ Event reminder problems:", JSON.stringify(summary));
            Sentry.captureMessage("Event reminder tick had failures", { level: "error", extra: { summary } });
        }
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

eventRemindersWorker.on("failed", (job, err) => {
    console.error(`❌ Event reminder job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id } });
});
eventRemindersWorker.on("error", err => console.error("❌ Event reminder worker error:", err.message));
