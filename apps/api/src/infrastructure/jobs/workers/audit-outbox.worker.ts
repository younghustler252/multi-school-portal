import * as Sentry from "@sentry/node";
import { Worker } from "bullmq";
import { redisConnection } from "../connection";
import { container } from "../../../container";
import { AuditOutboxRelay } from "../../../modules/audit/services/audit-outbox-relay.service";
import { ISchoolRepository } from "../../../modules/school/repositories/school.repository";

export const auditOutboxWorker = new Worker(
    "audit-outbox",
    async () => {
        const scope = container.createScope();
        const relay = scope.resolve<AuditOutboxRelay>("auditOutboxRelay");
        const schools = (await scope.resolve<ISchoolRepository>("schoolRepository").findMany({ isActive: true, schemaProvisionedAt: { not: null } }))
            .filter(s => !!s.schemaName).map(s => ({ id: s.id, name: s.name, schemaName: s.schemaName! }));
        const summary = await relay.drainAll(schools);
        if (summary.delivered || summary.failed || summary.crashedSchools.length) console.log("📜 Audit outbox:", JSON.stringify(summary));
        return summary;
    },
    { connection: redisConnection, concurrency: 1 },
);

auditOutboxWorker.on("failed", (job, err) => { console.error(`❌ Audit outbox job ${job?.id} failed:`, err.message); Sentry.captureException(err, { extra: { jobId: job?.id } }); });
auditOutboxWorker.on("error", err => console.error("❌ Audit outbox worker error:", err.message));
