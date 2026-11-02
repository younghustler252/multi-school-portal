import { Worker, Job } from "bullmq";
import * as Sentry from "@sentry/node";
import { redisConnection } from "../connection";
import { ClassPdfJob } from "../queues/class-pdf.queue";
import { TenantContext } from "../../database/prisma/tenant.context";
import { container } from "../../../container";
import type { ClassPdfJobRunner } from "../../../modules/report-cards/usecases/report-card-render.usecases";

/*
|--------------------------------------------------------------------------
| CLASS PDF WORKER
| Renders a whole class's report cards into ONE PDF and writes it into the cache the route reads from — it produces
| no other output. Runs inside the school's own database context, same as the notification worker. Re-gathers the
| cards itself rather than trusting anything passed in the job, so it is always correct even if a card changed
| between the route enqueueing the job and this worker picking it up (it will just cache under whichever hash its
| own fresh gather produces; the route's next poll/retry sees that).
| Concurrency 1: a class render already uses the shared browser pool (max 2 pages at once, see browser.service.ts),
| so there is no benefit — and a real cost in memory — to several of these running at the same time.
|--------------------------------------------------------------------------
*/
export const classPdfWorker = new Worker<ClassPdfJob>(
    "report-card-class-pdf",
    async (job: Job<ClassPdfJob>) => {
        const { schoolId, tenantSchema, termId, classId, template, include } = job.data;
        const runner = container.createScope().resolve<ClassPdfJobRunner>("classPdfJobRunner");
        await TenantContext.run({ tenantSchema, schoolId }, () => runner.run(schoolId, termId, classId, include, template));
    },
    { connection: redisConnection, concurrency: 1 },
);

classPdfWorker.on("failed", (job, err) => {
    const finalTry = !!job && job.attemptsMade >= (job.opts.attempts ?? 1);
    console.error(`❌ Class PDF job ${job?.id} failed (try ${job?.attemptsMade}):`, err.message);
    if (finalTry) Sentry.captureException(err, { extra: { jobId: job?.id, classId: job?.data.classId, schoolId: job?.data.schoolId } });
});
classPdfWorker.on("error", err => console.error("❌ Class PDF worker error:", err.message));
