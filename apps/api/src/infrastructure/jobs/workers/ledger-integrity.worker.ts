import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { RunLedgerIntegrityForAllSchoolsUseCase } from "../../../modules/ledger/usecases/ledger-integrity.usecases";

export const ledgerIntegrityWorker = new Worker(
    "ledger-integrity",
    async () => {
        // Scoped registrations need a scope when resolved outside a request
        const useCase = container.createScope().resolve<RunLedgerIntegrityForAllSchoolsUseCase>("runLedgerIntegrityForAllSchoolsUseCase");
        const summary = await useCase.execute();

        if (summary.failing.length || summary.crashed.length) {
            console.error("❌ Ledger integrity problems:", JSON.stringify(summary));
            Sentry.captureMessage("Ledger integrity check found problems", { level: "error", extra: { summary } });
        } else {
            console.log(`✅ Ledger integrity: ${summary.clean}/${summary.schools} schools clean`);
        }
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

ledgerIntegrityWorker.on("failed", (job, err) => {
    console.error(`❌ Ledger integrity job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { extra: { jobId: job?.id } });
});
ledgerIntegrityWorker.on("error", err => console.error("❌ Ledger integrity worker error:", err.message));
