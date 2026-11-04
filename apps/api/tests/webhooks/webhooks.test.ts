import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PaystackWebhookProvider } from "../../src/modules/webhooks/providers/paystack.webhook-provider";
import { WebhookProcessor } from "../../src/modules/webhooks/services/webhook-processor.service";
import { ReceiveWebhookUseCase, RetryWebhookEventUseCase, WebhookSummaryUseCase } from "../../src/modules/webhooks/usecases/webhook.usecases";
import { SubscriptionWebhookHandler } from "../../src/modules/subscriptions/webhooks/subscription.webhook-handler";
import { FeePaymentWebhookHandler } from "../../src/modules/payments/webhooks/fee-payment.webhook-handler";
import { TransferWebhookHandler } from "../../src/modules/payroll-transfers/webhooks/transfer.webhook-handler";
import type { WebhookEnvelope, WebhookHandler } from "../../src/modules/webhooks/domain/webhook.types";
import type { WebhookEventRow, IWebhookEventRepository } from "../../src/modules/webhooks/repositories/webhook-event.repository";

const SECRET = "sk_test_secret";
const sign = (body: string) => crypto.createHmac("sha512", SECRET).update(body).digest("hex");
const paymentProvider: any = { verifyWebhookSignature: (b: string, s: string) => s === sign(b) };
const body = (event: string, data: Record<string, any>) => JSON.stringify({ event, data });

/** In-memory event log with the same once-only and claim rules as the real repository. */
function memoryRepo() {
    const rows = new Map<string, WebhookEventRow>(); let seq = 0;
    const repo: IWebhookEventRepository = {
        async begin(i) {
            const prior = [...rows.values()].find(r => r.provider === i.provider && r.eventKey === i.eventKey);
            if (!prior) { const row = { id: `e${++seq}`, ...i, status: "received", error: null, attempts: 1, receivedAt: new Date(), processedAt: null, lastAttemptAt: new Date() } as WebhookEventRow; rows.set(row.id, row); return { row, run: true }; }
            if (prior.status === "processed" || prior.status === "ignored") return { row: prior, run: false };
            const took = prior.status === "failed" || prior.status === "received"; if (took) { prior.status = "received"; prior.attempts++; }
            return { row: prior, run: took };
        },
        async finish(id, status, error) { const r = rows.get(id)!; r.status = status; r.error = error ?? null; r.processedAt = status === "failed" ? null : new Date(); },
        async findById(id) { return rows.get(id) ?? null; },
        async claimForRetry(id) { const r = rows.get(id); if (!r || r.status !== "failed") return false; r.status = "received"; r.attempts++; return true; },
        async list() { return { rows: [...rows.values()], total: rows.size }; },
        async summary() { const m = new Map<string, number>(); for (const r of rows.values()) m.set(r.status, (m.get(r.status) ?? 0) + 1); return [...m].map(([status, count]) => ({ status: status as any, count })); },
    };
    return { repo, rows };
}

function world(handlers: WebhookHandler[]) {
    const { repo, rows } = memoryRepo();
    const provider = new PaystackWebhookProvider({ paymentProvider });
    const processor = new WebhookProcessor({ webhookEventRepository: repo, webhookHandlers: () => handlers });
    const audits: any[] = [];
    const d: any = { webhookEventRepository: repo, webhookProcessor: processor, webhookProviderFor: (n: string) => n === "paystack" ? provider : null, auditService: { log: async (a: any) => { audits.push(a); } } };
    const post = (event: string, data: any, sig?: string) => { const b = body(event, data); return new ReceiveWebhookUseCase(d).execute("paystack", b, { "x-paystack-signature": sig ?? sign(b) }); };
    return { d, rows, audits, post, repo };
}

const handler = (name: string, claims: (e: WebhookEnvelope) => boolean, run: (e: WebhookEnvelope) => Promise<"processed" | "ignored">, calls: string[] = []): WebhookHandler =>
    ({ name, handles: claims, handle: async (e) => { calls.push(`${name}:${e.reference}`); return run(e); } });

describe("webhook front door", () => {
    it("refuses an unknown provider, a bad signature and a body that is not JSON; nothing is logged for them", async () => {
        const w = world([]);
        await assert.rejects(() => new ReceiveWebhookUseCase(w.d).execute("flutterwave", "{}", {}), { code: "WEBHOOK_PROVIDER_UNKNOWN" });
        await assert.rejects(() => w.post("charge.success", { reference: "r1" }, "deadbeef"), { code: "WEBHOOK_SIGNATURE_INVALID" });
        await assert.rejects(() => new ReceiveWebhookUseCase(w.d).execute("paystack", "not json", { "x-paystack-signature": sign("not json") }), { code: "WEBHOOK_BODY_INVALID" });
        assert.equal(w.rows.size, 0);
    });
    it("the same event twice is handled once; the second answer says duplicate", async () => {
        const calls: string[] = [];
        const w = world([handler("a", e => e.type === "charge.success", async () => "processed", calls)]);
        assert.deepEqual(await w.post("charge.success", { id: 9, reference: "r1" }), { processed: true });
        assert.deepEqual(await w.post("charge.success", { id: 9, reference: "r1" }), { processed: true, duplicate: true });
        assert.equal(calls.length, 1);
    });
    it("an event nobody claims is logged as ignored", async () => {
        const w = world([handler("a", e => e.type === "charge.success", async () => "processed")]);
        assert.deepEqual(await w.post("customeridentification.success", { id: 1 }), { processed: false });
        assert.equal([...w.rows.values()][0].status, "ignored");
    });
    it("two handlers claiming one event is a failure (a wiring mistake), not a silent double action", async () => {
        const calls: string[] = [];
        const w = world([handler("a", () => true, async () => "processed", calls), handler("b", () => true, async () => "processed", calls)]);
        assert.deepEqual(await w.post("charge.success", { id: 1, reference: "r" }), { processed: false });
        assert.equal(calls.length, 0); assert.equal([...w.rows.values()][0].status, "failed");
    });
    it("a handler that throws leaves a FAILED event with the reason, still answers normally, and the provider's own retry runs it again", async () => {
        let boom = true; const calls: string[] = [];
        const w = world([handler("a", () => true, async () => { if (boom) throw new Error("school database busy"); return "processed"; }, calls)]);
        assert.deepEqual(await w.post("charge.success", { id: 5, reference: "r5" }), { processed: false });
        const row = [...w.rows.values()][0];
        assert.equal(row.status, "failed"); assert.equal(row.error, "school database busy");
        boom = false;
        assert.deepEqual(await w.post("charge.success", { id: 5, reference: "r5" }), { processed: true });
        assert.equal(row.status, "processed"); assert.equal(row.attempts, 2); assert.equal(calls.length, 2);
    });
});

describe("what is kept, and retry from the console", () => {
    it("only the fields a handler needs are stored: no customer, card or bank details", () => {
        const p = new PaystackWebhookProvider({ paymentProvider });
        const kept = p.slim({ id: 7, reference: "r", status: "success", amount: 100, customer: { email: "a@b.c" }, authorization: { last4: "4081" }, recipient: { details: { account_number: "0123456789" } }, metadata: { type: "school_fee", schoolId: "s1", paymentId: "p1", cardholder: "X" } });
        assert.deepEqual(kept, { id: 7, reference: "r", status: "success", amount: 100, metadata: { type: "school_fee", schoolId: "s1", paymentId: "p1" } });
    });
    it("a failed event can be retried from its stored fields; the retry is audited; only failed events can be retried", async () => {
        let boom = true; const seen: any[] = [];
        const w = world([handler("a", () => true, async (e) => { seen.push(e.data); if (boom) throw new Error("down"); return "processed"; })]);
        await w.post("charge.success", { id: 3, reference: "r3", customer: { email: "x@y.z" }, metadata: { type: "school_fee", schoolId: "s1" } });
        const id = [...w.rows.keys()][0]; boom = false;
        const retry = new RetryWebhookEventUseCase(w.d);
        const out = await retry.execute(id, "admin-1");
        assert.equal(out.status, "processed"); assert.equal(out.processed, true);
        assert.deepEqual(seen[1], { id: 3, reference: "r3", metadata: { type: "school_fee", schoolId: "s1" } });
        assert.equal(w.audits[0].action, "webhook.retried"); assert.equal(w.audits[0].userId, "admin-1");
        await assert.rejects(() => retry.execute(id, "admin-1"), { code: "WEBHOOK_NOT_RETRYABLE" });
        await assert.rejects(() => retry.execute("nope", "admin-1"), { code: "NOT_FOUND" });
    });
    it("an event logged before payloads were kept cannot be retried and says why; two retries at once: one wins", async () => {
        const w = world([handler("a", () => true, async () => { throw new Error("x"); })]);
        await w.post("charge.success", { id: 4, reference: "r4" });
        const row = [...w.rows.values()][0];
        const old = { ...row, payload: null }; w.rows.set(row.id, old as WebhookEventRow);
        await assert.rejects(() => new RetryWebhookEventUseCase(w.d).execute(row.id, "u"), { code: "WEBHOOK_NO_PAYLOAD" });
        w.rows.set(row.id, row);
        assert.equal(await w.repo.claimForRetry(row.id), true);
        assert.equal(await w.repo.claimForRetry(row.id), false);
        await assert.rejects(() => new RetryWebhookEventUseCase(w.d).execute(row.id, "u"), { code: "WEBHOOK_NOT_RETRYABLE" });
    });
    it("the summary counts events by status over a window", async () => {
        const w = world([handler("a", e => e.reference === "ok", async () => "processed")]);
        await w.post("charge.success", { id: 1, reference: "ok" }); await w.post("charge.success", { id: 2, reference: "other" });
        const s = await new WebhookSummaryUseCase({ ...w.d }).execute(24);
        assert.equal(s.processed, 1); assert.equal(s.ignored, 1); assert.equal(s.failed, 0); assert.equal(s.total, 2);
    });
});

describe("each event goes to exactly one owning module", () => {
    const stubs: any = { prismaClient: {}, billingEngine: {}, confirmOnlinePaymentUseCase: {}, handleTransferEventUseCase: {} };
    const sub = new SubscriptionWebhookHandler(stubs), fee = new FeePaymentWebhookHandler(stubs), tr = new TransferWebhookHandler(stubs);
    const ev = (type: string, data: any): WebhookEnvelope => ({ provider: "paystack", type, eventKey: "k", reference: data.reference ?? null, data });
    const owners = (e: WebhookEnvelope) => [sub, fee, tr].filter(h => h.handles(e)).map(h => h.name);

    it("subscription invoice, school fee, transfer and unrelated events have one owner (or none)", () => {
        assert.deepEqual(owners(ev("charge.success", { reference: "r", metadata: { type: "subscription_invoice" } })), ["subscriptions"]);
        assert.deepEqual(owners(ev("charge.success", { reference: "r", metadata: { type: "school_fee", schoolId: "s" } })), ["fee-payments"]);
        assert.deepEqual(owners(ev("charge.success", { reference: "r" })), ["fee-payments"], "a charge with no metadata is still tried as a fee (and fails clearly)");
        assert.deepEqual(owners(ev("transfer.success", { reference: "sal-x" })), ["payroll-transfers"]);
        assert.deepEqual(owners(ev("charge.success", {})), [], "no reference: nobody acts");
        assert.deepEqual(owners(ev("invoice.create", { reference: "r" })), []);
    });
    it("a fee payment without a school in its metadata fails clearly; a transfer reference that is not ours is ignored", async () => {
        await assert.rejects(() => fee.handle(ev("charge.success", { reference: "r1" })), /has no school in its metadata/);
        assert.equal(await tr.handle(ev("transfer.success", { reference: "not-ours" })), "ignored");
    });
    it("the subscription handler reconciles by reference", async () => {
        const seen: string[] = [];
        const h = new SubscriptionWebhookHandler({ billingEngine: { reconcile: async (r: string) => { seen.push(r); } } } as any);
        assert.equal(await h.handle(ev("charge.success", { reference: "inv-7", metadata: { type: "subscription_invoice" } })), "processed");
        assert.deepEqual(seen, ["inv-7"]);
    });
});
