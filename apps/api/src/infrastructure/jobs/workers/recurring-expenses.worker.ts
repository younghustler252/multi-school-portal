import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { RunRecurringForAllSchoolsUseCase } from "../../../modules/expenses/usecases/recurring.usecases";

export const recurringExpensesWorker = new Worker(
    "recurring-expenses",
    async () => {
        const useCase = container.createScope().resolve<RunRecurringForAllSchoolsUseCase>("runRecurringForAllSchoolsUseCase");
        const summary = await useCase.execute();
        if (summary.failing.length || summary.crashed.length) {
            console.error("❌ Recurring expenses problems:", JSON.stringify(summary));
            Sentry.captureMessage("Recurring expenses run had problems", { level: "error", extra: { summary } });
        } else {
            console.log(`✅ Recurring expenses: ${summary.created} made across ${summary.schools} schools`);
        }
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

recurringExpensesWorker.on("failed", (job, err) => {
    console.error(`❌ Recurring expenses job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id } });
});
recurringExpensesWorker.on("error", err => console.error("❌ Recurring expenses worker error:", err.message));
