import { randomUUID } from "crypto";
import { IAuditRepository } from "../repositories/audit.repository";
import { IAuditOutboxRepository, OutboxRow } from "../repositories/audit-outbox.repository";
import { auditFailureSink } from "./audit-failure-reporter";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";

/*
|--------------------------------------------------------------------------
| AUDIT OUTBOX RELAY (REM-077)
| Copies audit events that were saved in a school's database (same transaction as the change they record) to the
| public AuditLog, then deletes them from the school's outbox.
|
| Delivery is at-least-once and idempotent: each event keeps one id from the moment it is created, and the public insert
| skips ids that already exist. If this worker dies after the public insert and before the delete, the next run
| delivers the same event again and nothing is duplicated.
|
| Two relays can run at once: each claims its own rows (FOR UPDATE SKIP LOCKED, with a lease so a crashed relay's rows
| are picked up again). One event that cannot be delivered (for example a school id that no longer exists) is held back
| with a growing delay and reported; it never blocks the events behind it.
|--------------------------------------------------------------------------
*/
export interface RelayDeps { auditRepository: IAuditRepository; auditOutboxRepository: IAuditOutboxRepository }
export interface SchoolRef { id: string; name?: string; schemaName: string }
export interface RelaySummary { schools: number; delivered: number; failed: number; crashedSchools: string[] }

export class AuditOutboxRelay {
    static BATCH = 200;
    static LEASE_MS = 2 * 60_000;
    constructor(private readonly d: RelayDeps) {}

    /** Drains the CURRENT school's outbox (call inside TenantContext). Returns how many events were delivered / failed. */
    async drainCurrentSchool(maxBatches = 50): Promise<{ delivered: number; failed: number }> {
        let delivered = 0, failed = 0;
        for (let i = 0; i < maxBatches; i++) {
            const token = randomUUID();
            const rows = await this.d.auditOutboxRepository.claim(AuditOutboxRelay.BATCH, AuditOutboxRelay.LEASE_MS, token);
            if (!rows.length) break;
            const r = await this.deliver(rows, token);
            delivered += r.delivered; failed += r.failed;
            if (rows.length < AuditOutboxRelay.BATCH) break;
        }
        return { delivered, failed };
    }

    async drainAll(schools: SchoolRef[]): Promise<RelaySummary> {
        const out: RelaySummary = { schools: schools.length, delivered: 0, failed: 0, crashedSchools: [] };
        for (const s of schools) {
            try {
                const r = await TenantContext.run({ tenantSchema: s.schemaName, schoolId: s.id }, () => this.drainCurrentSchool());
                out.delivered += r.delivered; out.failed += r.failed;
            } catch (err) {
                out.crashedSchools.push(s.id);
                console.error(`⚠️  Audit outbox relay failed for school ${s.id}: ${(err as Error).message}`);
                auditFailureSink.report(err, { source: "audit", action: "audit.outbox.relay", schoolId: s.id });
            }
        }
        return out;
    }

    private async deliver(rows: OutboxRow[], token: string): Promise<{ delivered: number; failed: number }> {
        const repo = this.d.auditOutboxRepository;
        const toRow = (r: OutboxRow) => ({ ...r.payload, id: r.id, createdAt: new Date(r.payload.createdAt) });
        try {
            await this.d.auditRepository.createManyIdempotent(rows.map(toRow));
            await repo.deleteClaimed(rows.map(r => r.id), token);
            return { delivered: rows.length, failed: 0 };
        } catch {
            // One bad row fails the whole batch insert: go row by row so the good ones still get through
        }
        let delivered = 0, failed = 0;
        for (const r of rows) {
            try {
                await this.d.auditRepository.createManyIdempotent([toRow(r)]);
                await repo.deleteClaimed([r.id], token);
                delivered++;
            } catch (err) {
                failed++;
                await repo.recordFailure(r.id, token, (err as Error).message).catch(() => undefined);
                auditFailureSink.report(err, {
                    source: "audit", action: String(r.payload.action ?? "audit.outbox.deliver"), entity: r.payload.entity, entityId: r.payload.entityId,
                    schoolId: r.payload.schoolId, userId: r.payload.userId, requestId: r.payload.requestId,
                });
            }
        }
        return { delivered, failed };
    }
}
