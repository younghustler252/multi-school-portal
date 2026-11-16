import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { IAuditOutboxRepository, OutboxRow } from "./audit-outbox.repository";

export class AuditOutboxRepositoryImpl implements IAuditOutboxRepository {
    private get db() { return getTenantClient(); }

    async enqueue(id: string, payload: Record<string, any>): Promise<void> {
        await this.db.auditOutbox.create({ data: { id, payload } });
    }

    async claim(limit: number, leaseMs: number, token: string): Promise<OutboxRow[]> {
        // One statement: pick unclaimed (or expired-claim) rows, skipping rows another worker is claiming right now
        const rows = await this.db.$queryRawUnsafe<Array<{ id: string; payload: any; attempts: number }>>(
            `UPDATE "AuditOutbox" SET "claimToken" = $1, "claimExpiresAt" = now() + ($2::int * interval '1 millisecond')
             WHERE id IN (SELECT id FROM "AuditOutbox" WHERE "claimExpiresAt" IS NULL OR "claimExpiresAt" < now()
                          ORDER BY "createdAt", id LIMIT $3 FOR UPDATE SKIP LOCKED)
             RETURNING id, payload, attempts`, token, leaseMs, limit);
        return rows.map(r => ({ id: r.id, payload: r.payload, attempts: r.attempts }));
    }

    async deleteClaimed(ids: string[], token: string): Promise<void> {
        if (!ids.length) return;
        await this.db.auditOutbox.deleteMany({ where: { id: { in: ids }, claimToken: token } });
    }

    async recordFailure(id: string, token: string, error: string): Promise<void> {
        // Back off (1 minute per failed attempt, at most an hour) so one bad event is not retried every tick
        await this.db.$queryRawUnsafe(
            `UPDATE "AuditOutbox" SET attempts = attempts + 1, "lastError" = $3,
                    "claimExpiresAt" = now() + (least(attempts + 1, 60) * interval '1 minute')
             WHERE id = $1 AND "claimToken" = $2`, id, token, error.slice(0, 500));
    }
}
