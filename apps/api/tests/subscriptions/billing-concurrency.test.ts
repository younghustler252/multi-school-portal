/*
| REM-066 one live checkout per invoice · REM-067 lifecycle vs payment · REM-068 payments for different invoices of one subscription ·
| REM-070 captured money that cannot be applied is never lost. Against the in-memory Prisma stand-in (support/billing-world.ts): every row
| operation yields, FOR UPDATE is a real mutex, and `locksOff` shows the behaviour before the fix.
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BillingEngine } from "../../src/modules/subscriptions/services/billing-engine.service";
import { PlatformPaymentExceptionsUseCase } from "../../src/modules/subscriptions/usecases/platform/platform-billing.usecases";
import { billingWorld, day, T0 } from "./support/billing-world";

BillingEngine.CHECKOUT_POLL_MS = 5;
const pay = (w: any, inv: any, n = 1) => Array.from({ length: n }, () => w.engine.startCheckout({ invoiceId: inv.id, schoolId: "sc1", payerEmail: "a@b.c", callbackUrl: "https://x/cb", autoRenew: false }).then((r: any) => r, (e: any) => ({ error: e.code ?? String(e) })));
const attempts = (w: any, inv: any) => w.tables.paymentAttempt.filter((a: any) => a.invoiceId === inv.id);
const exceptions = (w: any) => w.tables.capturedPaymentException;

describe("REM-066: one live checkout per invoice", () => {
    let w: any; beforeEach(() => { w = billingWorld(); });

    it("six simultaneous pay requests create ONE attempt and ONE provider page; all get the same link", async () => {
        const inv = w.invoice();
        const res = await Promise.all(pay(w, inv, 6));
        assert.equal(w.calls.initialize, 1);
        assert.equal(attempts(w, inv).length, 1);
        assert.equal(new Set(res.map((r: any) => r.authorizationUrl)).size, 1, JSON.stringify(res));
        assert.ok(res.every((r: any) => r.authorizationUrl && r.reference === attempts(w, inv)[0].reference));
    });
    it("asking again later returns the same page without calling the provider again", async () => {
        const inv = w.invoice(); const [a] = await Promise.all(pay(w, inv)); const [b] = await Promise.all(pay(w, inv));
        assert.equal(b.authorizationUrl, a.authorizationUrl); assert.equal(w.calls.initialize, 1); assert.equal(attempts(w, inv).length, 1);
    });
    it("a page older than the reuse window is checked with the provider first: abandoned, then a new page is made", async () => {
        const inv = w.invoice(); const [a] = await Promise.all(pay(w, inv));
        const att = attempts(w, inv)[0]; att.createdAt = new Date(Date.now() - 45 * 60_000);
        w.verify = { [a.reference]: { status: "abandoned", reference: a.reference, amountKobo: att.amountKobo, paidAt: null, channel: "card", customerEmail: "a@b.c" } };
        const [b] = await Promise.all(pay(w, inv));
        assert.notEqual(b.reference, a.reference); assert.equal(attempts(w, inv).length, 2); assert.equal(att.status, "abandoned");
        assert.equal(attempts(w, inv).filter((x: any) => x.status === "pending").length, 1);
    });
    it("an old page that turns out to be PAID applies the invoice and the new pay request is refused", async () => {
        const inv = w.invoice(); const [a] = await Promise.all(pay(w, inv));
        const att = attempts(w, inv)[0]; att.createdAt = new Date(Date.now() - 45 * 60_000);
        w.verify = { [a.reference]: w.paid(att) };
        const [b] = await Promise.all(pay(w, inv));
        assert.equal(b.error, "INVOICE_NOT_PAYABLE"); assert.equal(w.inv(inv.id).status, "paid");
    });
    it("a provider failure closes the attempt so the next request can start a fresh checkout", async () => {
        const inv = w.invoice(); w.initFails = true;
        const [a] = await Promise.all(pay(w, inv)); assert.equal(a.error, "PAYMENT_UNAVAILABLE");
        assert.equal(attempts(w, inv)[0].status, "failed");
        w.initFails = false; const [b] = await Promise.all(pay(w, inv)); assert.ok(b.authorizationUrl); assert.equal(attempts(w, inv).length, 2);
    });
    it("an attempt that never received a page (a crash) is closed after a moment, not kept forever", async () => {
        const inv = w.invoice(); w.attempt(inv, { reference: "SEED-1", checkoutKey: inv.id, createdAt: new Date(Date.now() - 5 * 60_000) });
        const [b] = await Promise.all(pay(w, inv)); assert.ok(b.authorizationUrl);
        assert.equal(attempts(w, inv).filter((x: any) => x.status === "pending").length, 1);
    });
    it("the database backstop: a second pending checkout row for one invoice is refused (partial unique index)", async () => {
        const inv = w.invoice(); w.attempt(inv, { checkoutKey: inv.id });
        await assert.rejects(w.client.paymentAttempt.create({ data: { invoiceId: inv.id, reference: "x", amountKobo: 1, method: "checkout", checkoutKey: inv.id } }), (e: any) => e.code === "P2002");
        const done = w.tables.paymentAttempt[0]; done.status = "failed";
        await w.client.paymentAttempt.create({ data: { invoiceId: inv.id, reference: "y", amountKobo: 1, method: "checkout", checkoutKey: inv.id } });   // frees itself when the attempt is no longer pending
    });
    it("the migration declares the partial unique index and leaves existing rows alone", () => {
        const sql = readFileSync(new URL("../../prisma/migrations/20261115120000_billing_checkout_and_exceptions/migration.sql", import.meta.url), "utf8");
        assert.match(sql, /CREATE UNIQUE INDEX "PaymentAttempt_one_pending_checkout" ON "PaymentAttempt"\("checkoutKey"\) WHERE "status" = 'pending' AND "checkoutKey" IS NOT NULL/);
        assert.doesNotMatch(sql, /UPDATE "PaymentAttempt"/);
    });
});

describe("REM-067: payment vs lapse / past-due", () => {
    /** A renewal that is long overdue: the lifecycle job is about to write it off, and the school pays at that very moment. */
    const overdue = (w: any) => { const inv = w.invoice({ dueDate: day(-20), periodStart: day(-20), periodEnd: day(10) }); w.sub().currentPeriodEnd = day(-20); return inv; };
    const consistent = (w: any, inv: any) => {
        const paid = w.inv(inv.id).status === "paid";
        if (paid) assert.ok(w.sub().planId === "pro" && w.sub().status === "active", `invoice is paid but the school is ${w.sub().planId}/${w.sub().status}`);
    };

    it("lapse racing the payment: the school is never on Free with a paid invoice (30 randomised rounds)", async () => {
        for (let i = 0; i < 30; i++) {
            const w = billingWorld(); const inv = overdue(w); const att = w.attempt(inv);
            const lapse = (async () => { for (let k = 0; k < i % 5; k++) await new Promise(r => setImmediate(r)); await w.lifecycle.moveToFree("sub1", "lapsed", day(0)); })();
            const payment = (async () => { for (let k = 0; k < (i * 3) % 7; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(att.id, w.paid(att)); })();
            await Promise.all([lapse, payment]); consistent(w, inv);
        }
    });
    it("control: without the locks the lapse overwrites a payment that committed in between (the bug)", async () => {
        let broken = 0;
        for (let i = 0; i < 400; i++) {
            const w = billingWorld({ locksOff: true }); const inv = overdue(w); const att = w.attempt(inv);
            const dl = i % 20, dp = Math.floor(i / 20) % 20;
            const lapse = (async () => { for (let k = 0; k < dl; k++) await new Promise(r => setImmediate(r)); await w.lifecycle.moveToFree("sub1", "lapsed", day(0)); })();
            const payment = (async () => { for (let k = 0; k < dp; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(att.id, w.paid(att)); })();
            await Promise.all([lapse, payment]);
            if (w.inv(inv.id).status === "paid" && w.sub().planId === "free") broken++;
        }
        assert.ok(broken > 0, "the unlocked world should show a paid invoice on a Free school");
    });
    it("a lapse is dropped when the invoice was paid before it ran (sequential)", async () => {
        const w = billingWorld(); const inv = overdue(w); const att = w.attempt(inv);
        await w.engine.applyPaid(att.id, w.paid(att));
        await w.lifecycle.moveToFree("sub1", "lapsed", day(0));
        assert.equal(w.sub().planId, "pro"); assert.equal(w.inv(inv.id).status, "paid");
    });
    it("a scheduled cancellation is dropped when the school resumed before the job ran", async () => {
        const w = billingWorld(); w.sub().cancelAtPeriodEnd = false; w.sub().currentPeriodEnd = day(-1);
        await w.lifecycle.moveToFree("sub1", "cancelled", day(0));            // job-initiated (no actor): nothing asks for it any more
        assert.equal(w.sub().planId, "pro");
        await w.lifecycle.moveToFree("sub1", "cancelled", day(0), "user-1");  // an explicit cancel by the school still goes through
        assert.equal(w.sub().planId, "free");
    });
    it("past-due racing the payment: a paid renewal is never marked past due (30 randomised rounds)", async () => {
        for (let i = 0; i < 30; i++) {
            const w = billingWorld(); const inv = w.invoice({ dueDate: day(-1), periodStart: day(-1), periodEnd: day(29) }); w.sub().currentPeriodEnd = day(-1); const att = w.attempt(inv);
            const job = (async () => { for (let k = 0; k < i % 6; k++) await new Promise(r => setImmediate(r)); await w.lifecycle.run(day(0)); })();
            const payment = (async () => { for (let k = 0; k < (i * 5) % 11; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(att.id, w.paid(att)); })();
            await Promise.all([job, payment]);
            if (w.inv(inv.id).status === "paid") assert.equal(w.sub().status, "active", `round ${i}: paid invoice but subscription ${w.sub().status}`);
        }
    });
    it("control: without the locks a paid renewal is left past due", async () => {
        let broken = 0;
        for (let i = 0; i < 60; i++) {
            const w = billingWorld({ locksOff: true }); const inv = w.invoice({ dueDate: day(-1), periodStart: day(-1), periodEnd: day(29) }); w.sub().currentPeriodEnd = day(-1); const att = w.attempt(inv);
            const job = (async () => { for (let k = 0; k < i % 6; k++) await new Promise(r => setImmediate(r)); await w.lifecycle.run(day(0)); })();
            const payment = (async () => { for (let k = 0; k < (i * 5) % 14; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(att.id, w.paid(att)); })();
            await Promise.all([job, payment]);
            if (w.inv(inv.id).status === "paid" && w.sub().status === "past_due") broken++;
        }
        assert.ok(broken > 0, "the unlocked world should show a paid renewal left past due");
    });
});

describe("REM-068: payments for different invoices of one subscription", () => {
    // A renewal (period day 0..30) and an upgrade issued earlier in the CURRENT period (day -30..0, plan Max)
    const setup = () => {
        const w = billingWorld();
        const upgrade = w.invoice({ reason: "upgrade", planId: "max", totalKobo: 500_000, periodStart: day(-30), periodEnd: day(0), createdAt: day(-5) });
        const renewal = w.invoice({ reason: "renewal", planId: "pro", totalKobo: 1_000_000, periodStart: day(0), periodEnd: day(30), createdAt: day(-3) });
        return { w, upgrade, renewal, ua: w.attempt(upgrade), ra: w.attempt(renewal) };
    };
    const ledger = (w: any) => { for (const a of w.tables.paymentAttempt.filter((x: any) => x.status === "success")) {
        const inv = w.inv(a.invoiceId); const ex = w.tables.capturedPaymentException.find((e: any) => e.attemptId === a.id);
        assert.ok(inv.status === "paid" || ex, `a captured payment for ${inv.number} is neither applied nor recorded`);
    } };

    it("renewal paid first, then the older upgrade invoice: the period never moves back; the upgrade payment is recorded, not applied", async () => {
        const { w, upgrade, renewal, ua, ra } = setup();
        assert.equal(await w.engine.applyPaid(ra.id, w.paid(ra)), "paid");
        assert.equal(await w.engine.applyPaid(ua.id, w.paid(ua)), "superseded");
        assert.equal(w.sub().currentPeriodEnd.getTime(), day(30).getTime()); assert.equal(w.sub().planId, "pro");
        const ex = exceptions(w); assert.equal(ex.length, 1); assert.equal(ex[0].kind, "superseded"); assert.equal(ex[0].status, "open"); assert.equal(ex[0].amountKobo, 500_000);
        assert.equal(w.inv(upgrade.id).status, "void"); ledger(w);
    });
    it("upgrade paid first: it replaces the renewal (void), and a later payment of that renewal is recorded as paid-on-void", async () => {
        const { w, renewal, ua, ra } = setup();
        assert.equal(await w.engine.applyPaid(ua.id, w.paid(ua)), "paid"); assert.equal(w.sub().planId, "max");
        assert.equal(await w.engine.applyPaid(ra.id, w.paid(ra)), "paid_on_void");
        assert.equal(w.sub().planId, "max"); assert.equal(exceptions(w)[0].kind, "paid_on_void"); ledger(w);
    });
    it("both paid at the same moment (40 randomised rounds): one state, nothing stranded", async () => {
        for (let i = 0; i < 40; i++) {
            const { w, ua, ra } = setup();
            await Promise.all([
                (async () => { for (let k = 0; k < i % 5; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(ua.id, w.paid(ua)); })(),
                (async () => { for (let k = 0; k < (i * 3) % 7; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(ra.id, w.paid(ra)); })(),
            ]);
            ledger(w);
            const s = w.sub(); const paid = w.tables.subscriptionInvoice.filter((x: any) => x.status === "paid");
            assert.ok(paid.length >= 1 && paid.length <= 2);
            assert.equal(s.currentPeriodEnd.getTime(), Math.max(...paid.map((x: any) => x.periodEnd.getTime())), `round ${i}: the period went backwards`);
        }
    });
    it("control: without the locks, concurrent payments can leave the older period in force (the bug)", async () => {
        let backwards = 0;
        for (let i = 0; i < 60; i++) {
            const w = billingWorld({ locksOff: true });
            const upgrade = w.invoice({ reason: "upgrade", planId: "max", totalKobo: 500_000, periodStart: day(-30), periodEnd: day(0), createdAt: day(-5) });
            const renewal = w.invoice({ reason: "renewal", planId: "pro", periodStart: day(0), periodEnd: day(30), createdAt: day(-3) });
            const ua = w.attempt(upgrade), ra = w.attempt(renewal);
            await Promise.all([
                (async () => { for (let k = 0; k < i % 6; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(ua.id, w.paid(ua)); })(),
                (async () => { for (let k = 0; k < (i * 3) % 9; k++) await new Promise(r => setImmediate(r)); await w.engine.applyPaid(ra.id, w.paid(ra)); })(),
            ]);
            const paid = w.tables.subscriptionInvoice.filter((x: any) => x.status === "paid");
            if (w.sub().currentPeriodEnd.getTime() < Math.max(...paid.map((x: any) => x.periodEnd.getTime()))) backwards++;
        }
        assert.ok(backwards > 0, "the unlocked world should show a period moved backwards");
    });
});

describe("REM-070: captured money that cannot be applied is recorded", () => {
    let w: any; beforeEach(() => { w = billingWorld(); });

    it("a payment on a void invoice → open exception, attempt kept as success, audit written", async () => {
        const inv = w.invoice({ status: "void" }); const att = w.attempt(inv);
        assert.equal(await w.engine.applyPaid(att.id, w.paid(att)), "paid_on_void");
        const [e] = exceptions(w); assert.deepEqual([e.kind, e.status, e.amountKobo, e.reference, e.schoolId, e.invoiceId], ["paid_on_void", "open", 1_000_000, att.reference, "sc1", inv.id]);
        assert.ok(w.audits.some((a: any) => a.action === "billing.payment_on_void_invoice"));
    });
    it("a second capture for an already paid invoice → duplicate_payment exception; the first payment is untouched", async () => {
        const inv = w.invoice(); const a1 = w.attempt(inv), a2 = w.attempt(inv);
        assert.equal(await w.engine.applyPaid(a1.id, w.paid(a1)), "paid");
        assert.equal(await w.engine.applyPaid(a2.id, w.paid(a2)), "duplicate");
        assert.deepEqual(exceptions(w).map((e: any) => [e.kind, e.attemptId]), [["duplicate_payment", a2.id]]);
        assert.equal(w.inv(inv.id).status, "paid"); assert.equal(w.inv(inv.id).amountPaidKobo, 1_000_000);
    });
    it("an amount that does not match → amount_mismatch exception (not an ordinary failed payment); nothing applied", async () => {
        const inv = w.invoice(); const att = w.attempt(inv);
        assert.equal(await w.engine.applyPaid(att.id, w.paid(att, { amountKobo: 400_000 })), "mismatch");
        const [e] = exceptions(w); assert.equal(e.kind, "amount_mismatch"); assert.deepEqual(e.detail, { expectedKobo: 1_000_000, receivedKobo: 400_000, currency: "NGN" });
        assert.equal(w.inv(inv.id).status, "open"); assert.equal(att.status, "failed");
    });
    it("the same payment confirmed twice (browser and webhook) is one capture: outcome 'duplicate', no second exception row", async () => {
        const inv = w.invoice({ status: "void" }); const att = w.attempt(inv);
        await w.engine.applyPaid(att.id, w.paid(att)); await w.engine.applyPaid(att.id, w.paid(att));
        assert.equal(exceptions(w).length, 1);
    });
    it("a normal payment creates no exception", async () => {
        const inv = w.invoice(); const att = w.attempt(inv); assert.equal(await w.engine.applyPaid(att.id, w.paid(att)), "paid"); assert.equal(exceptions(w).length, 0);
    });

    describe("platform work-off", () => {
        const uc = (w: any) => new PlatformPaymentExceptionsUseCase({ prismaClient: w.client, auditService: w.deps.auditService } as any);
        it("lists open exceptions with a summary, resolves one with a note, and refuses to resolve it twice", async () => {
            const inv = w.invoice({ status: "void" }); const att = w.attempt(inv); await w.engine.applyPaid(att.id, w.paid(att));
            const id = exceptions(w)[0].id;
            assert.deepEqual(await uc(w).resolve(id, "admin-1", { resolution: "refunded", note: "Refunded at Paystack, ref RF-123" }), { resolved: true });
            const row = exceptions(w)[0]; assert.deepEqual([row.status, row.resolvedById, !!row.resolvedAt], ["refunded", "admin-1", true]);
            await assert.rejects(uc(w).resolve(id, "admin-2", { resolution: "dismissed", note: "second attempt at it" }), (e: any) => e.code === "CONFLICT" || /already resolved/.test(e.message));
            await assert.rejects(uc(w).resolve("nope", "admin-1", { resolution: "dismissed", note: "does not exist here" }), (e: any) => /not found/i.test(e.message));
            assert.ok(w.audits.some((a: any) => a.action === "billing.payment_exception_resolved"));
        });
    });
});
