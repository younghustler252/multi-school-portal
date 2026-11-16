/*
| REM-069: a coupon's maxUses can never be exceeded, and a discounted payment is never applied (or lost) when the last use was taken.
| The use is counted by one conditional UPDATE whose row count decides the outcome (support/billing-world.ts models it as atomic).
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { billingWorld } from "./support/billing-world";

const src = (p: string) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");
const attemptFor = (w: any, inv: any) => { const a = { id: `att-${inv.id}`, invoiceId: inv.id, reference: `REF-${inv.id}`, amountKobo: inv.totalKobo, status: "pending", method: "card", createdAt: new Date() }; w.tables.paymentAttempt.push(a); return a; };
const payAll = (w: any, invs: any[]) => Promise.all(invs.map(i => { const a = attemptFor(w, i); return w.engine.applyPaid(a.id, w.paid(a)); }));

describe("REM-069: coupon maxUses", () => {
    let w: any; beforeEach(() => { w = billingWorld(); });

    it("two invoices quoted with the LAST use, both paid at once: one is applied, the other becomes an open exception; usedCount never passes maxUses", async () => {
        const c = w.coupon({ maxUses: 1 }); const a = w.invoice({ couponId: c.id, totalKobo: 800_000 }); const b = w.invoice({ couponId: c.id, totalKobo: 800_000 });
        const out = await payAll(w, [a, b]);
        assert.deepEqual([...out].sort(), ["coupon_exhausted", "paid"]);
        assert.equal(c.usedCount, 1);
        const loser = [a, b].find(i => i.status !== "paid")!;
        assert.equal(loser.status, "void"); assert.equal(loser.note, "Coupon limit reached");
        const ex = w.tables.capturedPaymentException; assert.equal(ex.length, 1);
        assert.deepEqual([ex[0].kind, ex[0].status, ex[0].amountKobo, ex[0].invoiceId], ["coupon_exhausted", "open", 800_000, loser.id]);
        assert.ok(w.audits.some((x: any) => x.action === "billing.coupon_exhausted" && x.entityId === loser.id));
    });

    it("ten invoices, maxUses 3: exactly three are applied, seven become exceptions, no money is lost", async () => {
        const c = w.coupon({ maxUses: 3 }); const invs = Array.from({ length: 10 }, () => w.invoice({ couponId: c.id }));
        const out = await payAll(w, invs);
        assert.equal(out.filter(o => o === "paid").length, 3); assert.equal(out.filter(o => o === "coupon_exhausted").length, 7);
        assert.equal(c.usedCount, 3); assert.equal(w.tables.capturedPaymentException.length, 7);
        assert.equal(w.tables.paymentAttempt.filter((a: any) => a.status === "success").length, 10, "every captured payment is on record");
    });

    it("a coupon with no limit counts every use and never blocks", async () => {
        const c = w.coupon({ maxUses: null }); const out = await payAll(w, [w.invoice({ couponId: c.id }), w.invoice({ couponId: c.id }), w.invoice({ couponId: c.id })]);
        assert.deepEqual(out, ["paid", "paid", "paid"]); assert.equal(c.usedCount, 3); assert.equal(w.tables.capturedPaymentException.length, 0);
    });

    it("an invoice without a coupon is untouched by any of this", async () => {
        const c = w.coupon({ maxUses: 1, usedCount: 1 }); const inv = w.invoice();
        assert.deepEqual(await payAll(w, [inv]), ["paid"]); assert.equal(c.usedCount, 1);
    });

    it("the exhausted case does not change the subscription (no discount, no plan change, coupon not attached)", async () => {
        const c = w.coupon({ maxUses: 1, usedCount: 1 }); const inv = w.invoice({ couponId: c.id, planId: "max", reason: "upgrade" });
        const before = { ...w.sub() };
        assert.deepEqual(await payAll(w, [inv]), ["coupon_exhausted"]);
        assert.equal(w.sub().planId, before.planId); assert.equal(w.sub().couponId, before.couponId);
    });

    it("manual confirmation and zero-value application refuse an exhausted coupon and change nothing", async () => {
        const c = w.coupon({ maxUses: 1, usedCount: 1 });
        const m = w.invoice({ couponId: c.id }); await assert.rejects(w.engine.markPaidManually(m.id, "admin", "BANK-1"), (e: any) => e.code === "COUPON_INVALID");
        assert.equal(m.status, "open"); assert.equal(w.tables.paymentAttempt.length, 0);
        const z = w.invoice({ couponId: c.id, totalKobo: 0 }); await assert.rejects(w.engine.applyWithoutPayment(z.id, "admin", "comp"), (e: any) => e.code === "COUPON_INVALID");
        assert.equal(z.status, "open"); assert.equal(c.usedCount, 1);
    });

    it("manual confirmation with a coupon that still has a use counts it", async () => {
        const c = w.coupon({ maxUses: 2, usedCount: 1 }); const m = w.invoice({ couponId: c.id });
        await w.engine.markPaidManually(m.id, "admin", "BANK-2"); assert.equal(m.status, "paid"); assert.equal(c.usedCount, 2);
    });

    it("control: the old code (ignore the row count) applies BOTH discounts for a one-use coupon", async () => {
        const c = w.coupon({ maxUses: 1 }); (w.engine as any).reserveCoupon = async (tx: any, inv: any) => { await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE id = ${inv.couponId}`; return true; };
        const out = await payAll(w, [w.invoice({ couponId: c.id }), w.invoice({ couponId: c.id })]);
        assert.deepEqual(out, ["paid", "paid"], "two discounted invoices paid against a one-use coupon: the bug");
    });

    it("production wiring: every apply path reserves first, the old unchecked UPDATE is gone, and the enum + migration exist", () => {
        const e = src("src/modules/subscriptions/services/billing-engine.service.ts");
        assert.equal((e.match(/await this\.reserveCoupon\(tx, inv\)/g) ?? []).length, 3);
        assert.equal((e.match(/UPDATE "Coupon"/g) ?? []).length, 1);
        assert.match(e, /const changed = await tx\.\$executeRaw[\s\S]*return changed > 0/);
        assert.match(src("prisma/public.prisma"), /coupon_exhausted/);
        assert.match(src("prisma/migrations/20261116100000_coupon_exhausted_exception/migration.sql"), /ADD VALUE IF NOT EXISTS 'coupon_exhausted'/);
    });
});
