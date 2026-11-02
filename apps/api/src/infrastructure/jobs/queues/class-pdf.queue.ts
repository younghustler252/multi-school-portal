import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
|--------------------------------------------------------------------------
| CLASS PDF QUEUE
| One job per (school, term, class, template, include) whose PDF is not cached yet. Rendering a whole class can take
| long enough to outrun an HTTP/gateway timeout, so the route only ever renders synchronously on a CACHE HIT; a miss
| enqueues here and answers 202 with a job id to poll. The worker re-gathers the cards itself (never trusts stale
| data passed in the job) and writes the PDF into the same cache the route reads from, so once the job completes the
| ORIGINAL route call (repeated, or polled by the client) is a cache hit.
| Job id = the content hash the route itself computed, so two people asking for the exact same thing at the same
| moment share one job instead of rendering twice.
|--------------------------------------------------------------------------
*/
export interface ClassPdfJob {
    schoolId:     string;
    tenantSchema: string;
    termId:       string;
    classId:      string;
    template?:    string;
    include:      "published" | "all";
}

export const classPdfQueue = new Queue<ClassPdfJob>("report-card-class-pdf", { connection: redisConnection });

export async function enqueueClassPdf(jobId: string, data: ClassPdfJob): Promise<void> {
    await classPdfQueue.add("render", data, {
        jobId,
        attempts:         2,
        backoff:          { type: "exponential" as const, delay: 5000 },
        removeOnComplete: 500,
        removeOnFail:     500,
    });
}
