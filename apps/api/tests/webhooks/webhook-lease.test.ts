/*
| REM-102: one active processor per webhook event (lease token + expiry, compare-and-set claims).
| Handlers here are slow on purpose, so a second delivery arrives while the first is still running.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PaystackWebhookProvider } from "../../src/modules/webhooks/providers/paystack.webhook-provider";
import { WebhookProcessor } from "../../src/modules/webhooks/services/webhook-processor.service";
import { ReceiveWebhookUseCase, RetryWebhookEventUseCase } from "../../src/modules/webhooks/usecases/webhook.usecases";
import { WEBHOOK_LEASE_MS } from "../../src/modules/webhooks/repositories/webhook-event.repository";
import type { WebhookHandler } from "../../src/modules/webhooks/domain/webhook.types";
import { memoryRepo } from "./support/memory-repo";
import { readFileSync } from "node:fs";

const SECRET = "sk_test_secret";
const sign = (b: string) => crypto.createHmac("sha512", SECRET).update(b).digest("hex");
const provider = new PaystackWebhookProvider({ paymentProvider: { verifyWebhookSignature: (b: string, s: string) => s === sign(b) } as any });

function setup(opts: { leaseOff?: boolean } = {}, run: () => Promise<"processed" | "ignored">) {
    const m = memoryRepo(opts); const calls: number[] = [];
    const handler: WebhookHandler = { name: "h", handles: () => true, handle: async () => { calls.push(calls.length + 1); return run(); } };
    const processor = new WebhookProcessor({ webhookEventRepository: m.repo, webhookHandlers: () => [handler] });
    const d: any = { webhookEventRepository: m.repo, webhookProcessor: processor, webhookProviderFor: () => provider, auditService: { log: async () => {} } };
    const post = () => { const b = JSON.stringify({ event: "charge.success", data: { id: 1, reference: "r1" } }); return new ReceiveWebhookUseCase(d).execute("paystack", b, { "x-paystack-signature": sign(b) }); };
    return { ...m, calls, post, d };
}
const gate = () => { let open!: () => void; const p = new Promise<void>(r => (open = r)); return { p, open }; };

describe("webhook lease (REM-102)", () => {
    it("two simultaneous deliveries run the handler once; the second is told to come back (409), not acknowledged", async () => {
        const g = gate(); const w = setup({}, async () => { await g.p; return "processed"; });
        const first = w.post(); const second = w.post().then(() => "ok", e => e.code);
        assert.equal(await second, "WEBHOOK_IN_PROGRESS");
        g.open(); assert.deepEqual(await first, { processed: true });
        assert.equal(w.calls.length, 1);
        assert.deepEqual(await w.post(), { processed: true, duplicate: true });     // once finished, a redelivery is a plain duplicate
    });
    it("control: with the old claim rules both deliveries run the handler (the bug)", async () => {
        const g = gate(); const w = setup({ leaseOff: true }, async () => { await g.p; return "processed"; });
        const a = w.post(), b = w.post(); g.open(); await Promise.all([a, b]);
        assert.equal(w.calls.length, 2);
    });
    it("a crashed processor's event is reclaimable only after the lease expires", async () => {
        const w = setup({}, async () => "processed");
        const begun = await w.repo.begin({ provider: "paystack", eventKey: provider.parse(JSON.stringify({ event: "charge.success", data: { id: 1, reference: "r1" } })).eventKey, eventType: "charge.success", reference: "r1", payload: { data: { id: 1, reference: "r1" } } });
        assert.equal(begun.run, true);                                                     // ... and then the process dies: no finish()
        w.clock.now = new Date(w.clock.now.getTime() + WEBHOOK_LEASE_MS - 1000);
        assert.equal((await w.post().then(() => "ok", e => e.code)), "WEBHOOK_IN_PROGRESS");
        w.clock.now = new Date(w.clock.now.getTime() + 2000);
        assert.deepEqual(await w.post(), { processed: true }); assert.equal(w.calls.length, 1);
    });
    it("a slow processor that lost its lease cannot overwrite the new owner's outcome", async () => {
        const w = setup({}, async () => "processed");
        const key = { provider: "paystack", eventKey: "k", eventType: "charge.success", reference: "r", payload: {} };
        const old = await w.repo.begin(key);
        w.clock.now = new Date(w.clock.now.getTime() + WEBHOOK_LEASE_MS + 1);
        const fresh = await w.repo.begin(key); assert.equal(fresh.run, true); assert.notEqual(fresh.claimToken, old.claimToken);
        assert.equal(await w.repo.finish(fresh.row.id, fresh.claimToken!, "processed"), true);
        assert.equal(await w.repo.finish(old.row.id, old.claimToken!, "failed", "late"), false);
        assert.equal(w.rows.get(old.row.id)!.status, "processed");
    });
    it("a failed event is claimable at once; two console retries at once: one wins", async () => {
        let boom = true; const w = setup({}, async () => { if (boom) throw new Error("db busy"); return "processed"; });
        await w.post(); const id = [...w.rows.keys()][0]; assert.equal(w.rows.get(id)!.status, "failed");
        boom = false;
        const r = await Promise.allSettled([new RetryWebhookEventUseCase(w.d).execute(id, "u"), new RetryWebhookEventUseCase(w.d).execute(id, "u")]);
        assert.equal(r.filter(x => x.status === "fulfilled").length, 1);
        assert.equal(w.calls.length, 2);                                                  // the failed run plus ONE retry
    });
    it("the migration adds the processing state and the lease columns", () => {
        const sql = readFileSync(new URL("../../prisma/migrations/20261115100000_webhook_event_lease/migration.sql", import.meta.url), "utf8");
        assert.match(sql, /ADD VALUE IF NOT EXISTS 'processing'/); assert.match(sql, /"claimToken" TEXT/); assert.match(sql, /"claimExpiresAt" TIMESTAMP\(3\)/);
    });
});
