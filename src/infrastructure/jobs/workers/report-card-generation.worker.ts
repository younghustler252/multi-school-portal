import { Worker, Job } from "bullmq";
import { redisConnection } from "../connection";
import { ReportCardGenerationJobData } from "../queues/report-card-generation.queue";
import { TenantContext } from "../../database/prisma/tenant.context";
import { getTenantClient } from "../../database/prisma/prisma.client";
import { container } from "../../../container"; // ⚠️ adjust to your actual DI container export
import { GenerateReportCardUseCase } from "../../../modules/report-cards/usecases/generate-report-card.usecase";

interface StudentResult {
    studentId: string;
    status:    "generated" | "skipped" | "failed";
    reason?:   string;
}

export const reportCardGenerationWorker = new Worker<ReportCardGenerationJobData>(
    "report-card-generation",

    async (job: Job<ReportCardGenerationJobData>) => {
        const { schoolId, schemaName, termId, classId, principalRemark, triggeredByUserId } = job.data;

        return TenantContext.run(
            { tenantSchema: schemaName, schoolId },
            async () => {
                const db = getTenantClient();

                const students = classId
                    ? await db.enrolment
                        .findMany({ where: { classId, termId }, select: { studentId: true } })
                        .then(rows => rows.map(r => r.studentId))
                    : await db.enrolment
                        .findMany({ where: { termId }, select: { studentId: true } })
                        .then(rows => rows.map(r => r.studentId));

                const generateReportCardUseCase = container.resolve<GenerateReportCardUseCase>(
                    "generateReportCardUseCase",
                );

                const results: StudentResult[] = [];

                for (let i = 0; i < students.length; i++) {
                    const studentId = students[i];

                    try {
                        await generateReportCardUseCase.execute(
                            { studentId, termId, principalRemark },
                            schoolId,
                        );
                        results.push({ studentId, status: "generated" });
                    } catch (err) {
                        const message = err instanceof Error ? err.message : "Unknown error";

                        if (message.includes("already")) {
                            results.push({ studentId, status: "skipped", reason: "Already generated" });
                        } else {
                            results.push({ studentId, status: "failed", reason: message });
                        }
                    }

                    await job.updateProgress(Math.round(((i + 1) / students.length) * 100));
                }

                return {
                    total:     results.length,
                    generated: results.filter(r => r.status === "generated").length,
                    skipped:   results.filter(r => r.status === "skipped").length,
                    failed:    results.filter(r => r.status === "failed").length,
                    results,
                };
            },
        );
    },

    { connection: redisConnection, concurrency: 1 }, // one bulk job at a time — each already fans out across many PDF renders
);

reportCardGenerationWorker.on("completed", (job, result) => {
    console.log(`✅ Report card bulk job ${job.id} completed:`, result);
});

reportCardGenerationWorker.on("failed", (job, err) => {
    console.error(`❌ Report card bulk job ${job?.id} failed:`, err.message);
});