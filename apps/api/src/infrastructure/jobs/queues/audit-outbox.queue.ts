import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| AUDIT OUTBOX QUEUE (REM-077): one repeating job, every minute. It copies audit events saved inside school transactions
| to the public audit log. Running it twice at once is safe (each run claims its own rows).
*/
export const auditOutboxQueue = new Queue("audit-outbox", { connection: redisConnection });

export async function scheduleAuditOutbox(): Promise<void> {
    await auditOutboxQueue.upsertJobScheduler(
        "audit-outbox-relay",
        { every: 60_000 },
        { name: "run", opts: { removeOnComplete: 20, removeOnFail: 50, attempts: 1 } },
    );
}
