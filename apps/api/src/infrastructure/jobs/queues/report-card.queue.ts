import { Queue }            from "bullmq";
import { redisConnection }  from "../connection";

/*
|--------------------------------------------------------------------------
| REPORT CARD QUEUE
| Generates PDF report cards in background (can be slow with Puppeteer)
|--------------------------------------------------------------------------
*/

export interface ReportCardJobData {
    tenantSchema: string;
    studentId:    string;
    termId:       string;
}

export const reportCardQueue = new Queue<ReportCardJobData>(
    "report-card",
    { connection: redisConnection },
);

export const addReportCardJob = async (
    data: ReportCardJobData,
): Promise<void> => {
    await reportCardQueue.add("generate", data, {
        attempts:    2,
        backoff: {
            type:  "fixed",
            delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail:     false,
    });
};