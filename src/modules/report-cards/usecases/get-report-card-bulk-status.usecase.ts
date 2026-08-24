import { reportCardGenerationQueue } from "../../../infrastructure/jobs/queues/report-card-generation.queue";
import { NotFoundError } from "../../../shared/errors/domain.errors";
import type { JobProgress } from "bullmq";


export interface BulkJobStatus {
    jobId:         string;
    state:         string;
    progress:      JobProgress;
    result?:       any;
    failedReason?: string;
}

export class GetReportCardBulkStatusUseCase {
    async execute(jobId: string): Promise<BulkJobStatus> {
        const job = await reportCardGenerationQueue.getJob(jobId);
        if (!job) throw new NotFoundError("Job");

        const state = await job.getState();

        return {
            jobId:         job.id!,
            state,
            progress:      job.progress,
            result:        job.returnvalue,
            failedReason:  job.failedReason,
        };
    }
}