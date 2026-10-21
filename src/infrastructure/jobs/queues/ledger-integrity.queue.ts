import { Queue } from "bullmq";
import { redisConnection } from "../connection";

/*
| LEDGER INTEGRITY QUEUE: one repeating job, every night at 02:30 Lagos time (before the 03:00 school lifecycle run).
| Call scheduleLedgerIntegrity() once at start-up (it updates the schedule, it never duplicates it).
| The job is read-only, so running it twice is harmless. Needs BullMQ 5.16 or newer (upsertJobScheduler).
*/
export const ledgerIntegrityQueue = new Queue("ledger-integrity", { connection: redisConnection });

export async function scheduleLedgerIntegrity(): Promise<void> {
    await ledgerIntegrityQueue.upsertJobScheduler(
        "ledger-integrity-nightly",
        { pattern: "30 2 * * *", tz: "Africa/Lagos" },
        { name: "run", opts: { removeOnComplete: 20, removeOnFail: 50, attempts: 2 } },
    );
}
