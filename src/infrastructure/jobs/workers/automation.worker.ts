import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { RunAutomationsForAllSchoolsUseCase } from "../../../modules/automation/usecases/automation.usecases";

export const automationWorker = new Worker(
    "automation",
    async () => {
        const useCase = container.createScope().resolve<RunAutomationsForAllSchoolsUseCase>("runAutomationsForAllSchoolsUseCase");
        const summary = await useCase.execute();
        if (summary.crashed.length || summary.failed) {
            console.error("❌ Automation problems:", JSON.stringify(summary));
            Sentry.captureMessage("Automation tick had failures", { level: "error", extra: { summary } });
        }
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

automationWorker.on("failed", (job, err) => {
    console.error(`❌ Automation job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id } });
});
automationWorker.on("error", err => console.error("❌ Automation worker error:", err.message));
