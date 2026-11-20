import { randomUUID } from "node:crypto";
import { WEBHOOK_LEASE_MS, type IWebhookEventRepository } from "../../../src/modules/webhooks/repositories/webhook-event.repository";
import type { WebhookEventRow } from "../../../src/modules/webhooks/repositories/webhook-event.repository";

/**
 * In-memory event log with the same once-only, lease and compare-and-set rules as WebhookEventRepositoryImpl (REM-102).
 * Each method decides and writes in one synchronous step, like the single conditional UPDATE the real repository issues.
 * `clock.now` lets a test move time past the lease. `leaseOff` models the OLD behaviour (a received event is always claimable,
 * outcomes are written by anyone) so a control test can show the race the lease prevents.
 */
export function memoryRepo(o: { clock?: { now: Date }; leaseOff?: boolean } = {}) {
    const clock = o.clock ?? { now: new Date() };
    const rows = new Map<string, WebhookEventRow>(); let seq = 0;
    const live = (r: WebhookEventRow) => !!r.claimExpiresAt && r.claimExpiresAt > clock.now;
    const claimable = (r: WebhookEventRow) => o.leaseOff
        ? r.status === "failed" || r.status === "received" || r.status === "processing"
        : r.status === "failed" || ((r.status === "processing" || r.status === "received") && !live(r) && (r.status === "processing" || !r.lastAttemptAt || r.lastAttemptAt.getTime() < clock.now.getTime() - WEBHOOK_LEASE_MS));
    const take = (r: WebhookEventRow) => { const t = randomUUID(); r.status = "processing"; r.attempts++; r.lastAttemptAt = clock.now; r.claimToken = t; r.claimExpiresAt = new Date(clock.now.getTime() + WEBHOOK_LEASE_MS); return t; };
    const repo: IWebhookEventRepository = {
        async begin(i) {
            const prior = [...rows.values()].find(r => r.provider === i.provider && r.eventKey === i.eventKey);
            if (!prior) {
                const row = { id: `e${++seq}`, ...i, status: "processing", error: null, attempts: 0, receivedAt: clock.now, processedAt: null, lastAttemptAt: clock.now, claimToken: null, claimExpiresAt: null } as WebhookEventRow;
                rows.set(row.id, row); const t = take(row); row.attempts = 1; return { row, run: true, claimToken: t, inProgress: false };
            }
            if (prior.status === "processed" || prior.status === "ignored") return { row: prior, run: false, claimToken: null, inProgress: false };
            if (claimable(prior)) return { row: prior, run: true, claimToken: take(prior), inProgress: false };
            return { row: prior, run: false, claimToken: null, inProgress: true };
        },
        async finish(id, token, status, error) {
            const r = rows.get(id)!;
            if (!o.leaseOff && (r.claimToken !== token || r.status !== "processing")) return false;
            r.status = status; r.error = error ?? null; r.processedAt = status === "failed" ? null : clock.now; r.claimToken = null; r.claimExpiresAt = null; return true;
        },
        async findById(id) { return rows.get(id) ?? null; },
        async claimForRetry(id) { const r = rows.get(id); if (!r || !claimable(r)) return null; return take(r); },
        async findFailedUnderLimit(max, limit) { return [...rows.values()].filter(r => r.status === "failed" && r.attempts < max).sort((a, b) => (a.lastAttemptAt?.getTime() ?? 0) - (b.lastAttemptAt?.getTime() ?? 0)).slice(0, limit); },
        async list() { return { rows: [...rows.values()], total: rows.size }; },
        async summary() { const m = new Map<string, number>(); for (const r of rows.values()) m.set(r.status, (m.get(r.status) ?? 0) + 1); return [...m].map(([status, count]) => ({ status: status as any, count })); },
    };
    return { repo, rows, clock };
}
