import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { RunSchoolLifecycleUseCase } from "../../../modules/school/usecases/platform/run-school-lifecycle.usecase";

export const schoolLifecycleWorker = new Worker(
    "school-lifecycle",
    async () => {
        // Scoped registrations need a scope when resolved outside a request
        const useCase = container.createScope().resolve<RunSchoolLifecycleUseCase>("runSchoolLifecycleUseCase");
        const summary = await useCase.execute();
        console.log("🏫 School lifecycle run:", summary);
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

schoolLifecycleWorker.on("failed", (job, err) => {
    console.error(`❌ School lifecycle job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id } });
});
schoolLifecycleWorker.on("error", err => console.error("❌ School lifecycle worker error:", err.message));
