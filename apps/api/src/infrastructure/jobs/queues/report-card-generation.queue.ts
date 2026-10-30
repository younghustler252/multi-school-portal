import { Queue } from "bullmq";
import { redisConnection } from "../connection";

export interface ReportCardGenerationJobData {
    schoolId:          string;
    schemaName:        string;
    termId:            string;
    classId?:          string;
    principalRemark?:  string;
    triggeredByUserId: string;
}

export const reportCardGenerationQueue = new Queue<ReportCardGenerationJobData>(
    "report-card-generation",
    { connection: redisConnection },
);

export async function addBulkReportCardJob(data: ReportCardGenerationJobData): Promise<string> {
    const job = await reportCardGenerationQueue.add("generate-bulk", data);
    return job.id!;
}