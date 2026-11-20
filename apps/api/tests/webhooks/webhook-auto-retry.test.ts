/*
| REM-103: failed webhook events retry on their own, with back-off, a hard limit and a one-time alert; no event is processed twice.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { memoryRepo } from "./support/memory-repo";
import { WebhookProcessor } from "../../src/modules/webhooks/services/webhook-processor.service";
import { AutoRetryWebhooksUseCase, WEBHOOK_MAX_ATTEMPTS, webhookBackoffMs, webhookDue } from "../../src/modules/webhooks/usecases/auto-retry.usecase";

const MIN = 60_000;
const src = (p: string) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const payload = { data: { reference: "R1" } };

function world(handle: (n: number) => "processed" | "ignored" | "throw") {
    const m = memoryRepo(); let calls = 0; const alerts: any[] = [], audits: any[] = [];
    const handler = { name: "h", handles: () => true, async handle() { const o = handle(++calls); if (o === "throw") throw new Error("handler failed"); return o; } };
    const processor = new WebhookProcessor({ webhookEventRepository: m.repo, webhookHandlers: () => [handler as any] } as any);
    const uc = new AutoRetryWebhooksUseCase({ webhookEventRepository: m.repo, webhookProcessor: processor, auditService: { async log(a: any) { audits.push(a); } } }, { now: () => m.clock.now, alert: (msg, ctx) => alerts.push({ msg, ctx }) });
    const receive = async (key = "evt-1") => {                               // the provider's first delivery, which fails
        const b = await m.repo.begin({ provider: "paystack", eventKey: key, eventType: "charge.success", reference: "R1", payload });
        const r = await processor.process(b.row.id, b.claimToken!, { provider: "paystack", type: "charge.success", eventKey: key, reference: "R1", data: payload.data });
        return { id: b.row.id, r };
    };
    const advance = (ms: number) => { m.clock.now = new Date(m.clock.now.getTime() + ms); };
    return { m, uc, receive, advance, alerts, audits, calls: () => calls };
}

describe("REM-103: automatic webhook retry", () => {
    it("back-off grows 2, 4, 8, 16, 32 minutes and is capped at 6 hours", () => {
        assert.deepEqual([1, 2, 3, 4, 5].map(n => webhookBackoffMs(n) / MIN), [2, 4, 8, 16, 32]);
        assert.equal(webhookBackoffMs(20) / MIN, 360);
        const base = new Date("2026-11-19T10:00:00Z");
        assert.equal(webhookDue({ attempts: 1, lastAttemptAt: base, receivedAt: base }, new Date(base.getTime() + 119_000)), false);
        assert.equal(webhookDue({ attempts: 1, lastAttemptAt: base, receivedAt: base }, new Date(base.getTime() + 120_000)), true);
    });

    it("a failed event is retried once its back-off has passed, and a success ends it", async () => {
        const w = world(n => n === 1 ? "throw" : "processed");
        const { id, r } = await w.receive(); assert.equal(r.failed, true);
        assert.deepEqual(await w.uc.execute(), { tried: 0, processed: 0, ignored: 0, failed: 0, dead: 0, skipped: 0 }, "too early: back-off not over");
        w.advance(2 * MIN);
        const s = await w.uc.execute();
        assert.equal(s.tried, 1); assert.equal(s.processed, 1);
        assert.equal(w.m.rows.get(id)!.status, "processed"); assert.equal(w.m.rows.get(id)!.attempts, 2);
        assert.equal(w.audits.at(-1).action, "webhook.auto_retried");
        w.advance(60 * MIN); assert.equal((await w.uc.execute()).tried, 0, "a processed event is never retried again");
    });

    it("an event that keeps failing stops after the limit, is alerted once, and stays FAILED for the manual button", async () => {
        const w = world(() => "throw");
        const { id } = await w.receive();
        let totalTried = 0;
        for (let i = 0; i < 20; i++) { w.advance(7 * 60 * MIN); totalTried += (await w.uc.execute()).tried; }
        const row = w.m.rows.get(id)!;
        assert.equal(row.status, "failed"); assert.equal(row.attempts, WEBHOOK_MAX_ATTEMPTS);
        assert.equal(totalTried, WEBHOOK_MAX_ATTEMPTS - 1, "the first delivery counted as attempt one");
        assert.equal(w.calls(), WEBHOOK_MAX_ATTEMPTS);
        assert.equal(w.alerts.length, 1); assert.match(w.alerts[0].msg, /will not be retried automatically/); assert.equal(w.alerts[0].ctx.id, id);
        assert.equal(w.audits.filter(a => a.action === "webhook.dead").length, 1);
    });

    it("an event the handler ignores is a final outcome, not a failure and not an alert", async () => {
        const w = world(n => n === 1 ? "throw" : "ignored");
        const { id } = await w.receive(); w.advance(2 * MIN);
        const s = await w.uc.execute(); assert.deepEqual([s.ignored, s.failed, s.dead], [1, 0, 0]);
        assert.equal(w.m.rows.get(id)!.status, "ignored"); assert.equal(w.alerts.length, 0);
    });

    it("two runs at the same moment (or a person pressing retry) process the event once", async () => {
        const w = world(n => n === 1 ? "throw" : "processed");
        await w.receive(); w.advance(2 * MIN);
        const [a, b] = await Promise.all([w.uc.execute(), w.uc.execute()]);
        assert.equal(a.tried + b.tried, 1); assert.equal(w.calls(), 2);
    });

    it("an event with no stored payload is skipped (a person must look at it); processing events are not touched", async () => {
        const w = world(() => "throw");
        const b = await w.m.repo.begin({ provider: "paystack", eventKey: "nopayload", eventType: "x", reference: null, payload: null });
        await w.m.repo.finish(b.row.id, b.claimToken!, "failed", "boom"); w.advance(2 * MIN);
        const s = await w.uc.execute(); assert.equal(s.skipped, 1); assert.equal(s.tried, 0); assert.equal(w.calls(), 0);
    });

    it("production wiring: repository query, container, queue, worker and schedule exist", () => {
        assert.match(src("src/modules/webhooks/repositories/webhook-event.repository.impl.ts"), /status: "failed", attempts: \{ lt: maxAttempts \}/);
        assert.match(src("src/modules/webhooks/webhooks.container.ts"), /autoRetryWebhooksUseCase:\s+asClass\(AutoRetryWebhooksUseCase\)/);
        assert.match(src("src/infrastructure/jobs/queues/webhook-retry.queue.ts"), /every: 60_000/);
        assert.match(src("src/infrastructure/jobs/workers/webhook-retry.worker.ts"), /autoRetryWebhooksUseCase/);
        assert.match(src("src/infrastructure/jobs/index.ts"), /webhook-retry\.worker/);
        assert.match(src("src/infrastructure/jobs/schedulers/index.ts"), /scheduleWebhookRetry\(\)/);
    });
});
