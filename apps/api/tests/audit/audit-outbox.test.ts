/*
| REM-077: audit events written inside a school transaction are atomic with it (outbox) and reach the public audit log
| exactly once, eventually.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AuditService } from "../../src/modules/audit/services/audit.service";
import { AuditOutboxRelay } from "../../src/modules/audit/services/audit-outbox-relay.service";
import { auditFailureSink } from "../../src/modules/audit/services/audit-failure-reporter";
import { TenantContext } from "../../src/infrastructure/database/prisma/tenant.context";

const tick = (ms = 1) => new Promise(r => setTimeout(r, ms));
const src = (p: string) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

function world(o: { withOutbox?: boolean } = {}) {
    const publicLog = new Map<string, any>();                       // the public AuditLog (unique by id)
    const outbox = new Map<string, { id: string; payload: any; attempts: number; claimToken?: string; claimExpiresAt?: number }>();
    const pending = new Map<object, any[]>();                       // outbox rows written in an open transaction
    let clock = 1_000_000;
    const hooks = { failDelete: 0, failPublicFor: new Set<string>(), enqueueFails: false };

    const auditRepository: any = {
        async create(row: any) { publicLog.set(row.id, row); return row; },
        async createManyIdempotent(rows: any[]) {
            for (const r of rows) if (hooks.failPublicFor.has(r.schoolId)) throw new Error("FK violation (school)");
            let n = 0; for (const r of rows) if (!publicLog.has(r.id)) { publicLog.set(r.id, r); n++; } return n;
        },
    };
    const auditOutboxRepository: any = {
        async enqueue(id: string, payload: any) {
            if (hooks.enqueueFails) throw new Error("outbox insert failed");
            const tx = TenantContext.getTransaction() as object | null;
            if (!tx) throw new Error("enqueue outside a transaction");
            (pending.get(tx) ?? pending.set(tx, []).get(tx)!).push({ id, payload, attempts: 0 });
        },
        async claim(limit: number, leaseMs: number, token: string) {
            await tick();
            const rows = [...outbox.values()].filter(r => !r.claimExpiresAt || r.claimExpiresAt < clock).slice(0, limit);
            for (const r of rows) { r.claimToken = token; r.claimExpiresAt = clock + leaseMs; }
            return rows.map(r => ({ id: r.id, payload: r.payload, attempts: r.attempts }));
        },
        async deleteClaimed(ids: string[], token: string) {
            if (hooks.failDelete > 0) { hooks.failDelete--; throw new Error("worker died before delete"); }
            for (const id of ids) if (outbox.get(id)?.claimToken === token) outbox.delete(id);
        },
        async recordFailure(id: string, token: string, _e: string) {
            const r = outbox.get(id); if (r?.claimToken === token) { r.attempts++; r.claimExpiresAt = clock + 60_000 * Math.min(r.attempts, 60); }
        },
    };
    const service = new AuditService({ auditRepository, auditOutboxRepository: o.withOutbox === false ? undefined : auditOutboxRepository });
    const relay = () => new AuditOutboxRelay({ auditRepository, auditOutboxRepository });

    /** A school transaction: outbox rows written inside commit with it, or vanish when it throws. */
    async function inTx<T>(fn: () => Promise<T>): Promise<T> {
        const tx = {};
        try {
            const r = await TenantContext.run({ tenantSchema: "t_a", schoolId: "sch-1", tx: tx as any }, fn);
            for (const row of pending.get(tx) ?? []) outbox.set(row.id, row);
            return r;
        } finally { pending.delete(tx); }
    }
    const drain = (relayInstance = relay()) => TenantContext.run({ tenantSchema: "t_a", schoolId: "sch-1" }, () => relayInstance.drainCurrentSchool());
    return { publicLog, outbox, hooks, service, relay, inTx, drain, advance: (ms: number) => { clock += ms; } };
}
const ev = (n = 1) => ({ userId: "u1", schoolId: "sch-1", action: "fees.invoice.issued", entity: "Invoice", entityId: `inv-${n}`, newValue: { n } });

describe("REM-077: audit is atomic with the school transaction", () => {
    it("a committed transaction leaves a durable outbox row and no public row yet; the relay then delivers it once with the same id", async () => {
        const w = world();
        await w.inTx(async () => { await w.service.log(ev()); });
        assert.equal(w.publicLog.size, 0); assert.equal(w.outbox.size, 1);
        const id = [...w.outbox.keys()][0];
        assert.deepEqual(await w.drain(), { delivered: 1, failed: 0 });
        assert.equal(w.outbox.size, 0); assert.equal(w.publicLog.size, 1);
        const row = w.publicLog.get(id); assert.equal(row.action, "fees.invoice.issued"); assert.ok(row.createdAt instanceof Date);
    });

    it("a ROLLED-BACK transaction produces no audit event anywhere", async () => {
        const w = world();
        await assert.rejects(w.inTx(async () => { await w.service.log(ev()); throw new Error("business failure"); }), /business failure/);
        await w.drain();
        assert.equal(w.outbox.size, 0); assert.equal(w.publicLog.size, 0);
    });

    it("control: the old behaviour (direct public write) records the change that was rolled back", async () => {
        const w = world({ withOutbox: false });
        await assert.rejects(w.inTx(async () => { await w.service.log(ev()); throw new Error("business failure"); }));
        assert.equal(w.publicLog.size, 1, "the phantom audit row of the bug");
    });

    it("if the outbox insert fails inside the transaction, the transaction fails too (no committed change without its audit event)", async () => {
        const w = world(); w.hooks.enqueueFails = true; let businessWrite = false;
        await assert.rejects(w.inTx(async () => { await w.service.log(ev()); businessWrite = true; }), /outbox insert failed/);
        assert.equal(businessWrite, false); assert.equal(w.outbox.size, 0);
    });

    it("outside any transaction the event is written straight to the public log, best effort", async () => {
        const w = world();
        await TenantContext.run({ tenantSchema: "t_a", schoolId: "sch-1" }, () => w.service.log(ev()));
        await w.service.log(ev(2));                                   // and with no tenant context at all
        assert.equal(w.publicLog.size, 2); assert.equal(w.outbox.size, 0);
    });

    it("a worker that dies after the public insert but before the delete redelivers later without a duplicate", async () => {
        const w = world();
        await w.inTx(async () => { await w.service.log(ev(1)); await w.service.log(ev(2)); });
        w.hooks.failDelete = 3;                                       // the batch delete and both per-row fallback deletes fail
        await w.drain();                                              // rows are in the public log AND still in the outbox
        assert.equal(w.publicLog.size, 2); assert.equal(w.outbox.size, 2);
        w.hooks.failDelete = 0;
        assert.deepEqual(await w.drain(), { delivered: 0, failed: 0 }, "still leased or backed off: not claimed again yet");
        w.advance(AuditOutboxRelay.LEASE_MS + 3_600_000 + 1);
        await w.drain();
        assert.equal(w.publicLog.size, 2, "no duplicates"); assert.equal(w.outbox.size, 0);
    });

    it("two relays at once deliver every event exactly once", async () => {
        const w = world();
        await w.inTx(async () => { for (let i = 0; i < 25; i++) await w.service.log(ev(i)); });
        await Promise.all([w.drain(), w.drain(), w.drain()]);
        assert.equal(w.publicLog.size, 25); assert.equal(w.outbox.size, 0);
    });

    it("one undeliverable event is held back and reported; it never blocks the others", async () => {
        const w = world(); const reports: any[] = []; const real = auditFailureSink.report; auditFailureSink.report = (_e, c) => { reports.push(c); };
        w.hooks.failPublicFor.add("gone-school");
        try {
            await w.inTx(async () => { await w.service.log(ev(1)); await w.service.log({ ...ev(2), schoolId: "gone-school" }); await w.service.log(ev(3)); });
            const r = await w.drain();
            assert.deepEqual(r, { delivered: 2, failed: 1 });
            assert.equal(w.publicLog.size, 2); assert.equal(w.outbox.size, 1);
            assert.equal([...w.outbox.values()][0].attempts, 1);
            assert.equal(reports.length, 1); assert.equal(reports[0].entityId, "inv-2");
            assert.deepEqual(await w.drain(), { delivered: 0, failed: 0 }, "backed off, not retried on the next tick");
        } finally { auditFailureSink.report = real; }
    });

    it("the event keeps the time it happened, not the time it was delivered", async () => {
        const w = world();
        await w.inTx(async () => { await w.service.log(ev()); });
        const created = [...w.outbox.values()][0].payload.createdAt; await tick(5); await w.drain();
        assert.equal([...w.publicLog.values()][0].createdAt.toISOString(), created);
    });

    it("production wiring: migration, model, claim SQL, registration and schedule exist", () => {
        assert.match(src("prisma/tenant-migrations/20261116090000_audit_outbox/migration.sql"), /CREATE TABLE "AuditOutbox"/);
        assert.match(src("prisma/tenant.prisma"), /model AuditOutbox \{/);
        assert.match(src("src/modules/audit/repositories/audit-outbox.repository.impl.ts"), /FOR UPDATE SKIP LOCKED/);
        assert.match(src("src/modules/audit/repositories/audit.repository.impl.ts"), /skipDuplicates: true/);
        assert.match(src("src/modules/audit/audit.container.ts"), /auditOutboxRepository:[^\n]*AuditOutboxRepositoryImpl/);
        assert.match(src("src/modules/audit/audit.container.ts"), /auditOutboxRelay:/);
        assert.match(src("src/infrastructure/jobs/index.ts"), /audit-outbox\.worker/);
        assert.match(src("src/infrastructure/jobs/schedulers/index.ts"), /scheduleAuditOutbox\(\)/);
        assert.match(src("src/modules/audit/services/audit.service.ts"), /TenantContext\.getTransaction\(\)/);
    });
});
