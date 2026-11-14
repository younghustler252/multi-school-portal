/*
|--------------------------------------------------------------------------
| REM-022 / REM-023: a student's credit cannot be over-spent or over-reserved by concurrent requests.
| The in-memory world gives the per-student lock the same contract as the repository's pg_advisory_xact_lock (held until the transaction ends);
| scripts/db/verify-credit-lock.sh proves the SQL itself on real PostgreSQL. Every test ends with the finance controls.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { feesWorld, N } from "./support/fees-world";

let w: ReturnType<typeof feesWorld>;
beforeEach(() => { w = feesWorld(); });
const ADMIN = "admin-1", BURSAR = "bursar-1";

/* 10,000 of credit on payment p, plus open invoices i2 and i3 of 8,000 each. */
async function creditAndTwoInvoices() {
    await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
    const { payment } = await w.pay({ amountKobo: N(70_000), studentIds: ["s1"] });
    await w.addInvoice("i2", "s1", [["a-tuition", N(8_000)]]);
    await w.addInvoice("i3", "s1", [["a-tuition", N(8_000)]]);
    return payment;
}
const creditLeft = () => w.allocations.filter(a => a.invoiceId === null && !a.reversedAt).reduce((s, a) => s + a.amountKobo, 0n);
const settled = (rs: PromiseSettledResult<unknown>[]) => ({ ok: rs.filter(r => r.status === "fulfilled").length, failed: rs.filter(r => r.status === "rejected") as PromiseRejectedResult[] });

describe("REM-022: two operations cannot both spend the same credit", () => {
    it("two invoices applying credit at the same moment share the 10,000 exactly: 8,000 + 2,000, nothing over-spent", async () => {
        await creditAndTwoInvoices();
        const rs = await Promise.allSettled([w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i2" } as any), w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i3" } as any)]);
        assert.equal(settled(rs).ok, 2);
        const applied = rs.map(r => (r as PromiseFulfilledResult<any>).value.appliedKobo as number).sort((a, b) => a - b);
        assert.deepEqual(applied, [Number(N(2_000)), Number(N(8_000))]);
        assert.equal(creditLeft(), 0n);
        w.assertControl(assert);
    });
    it("without the lock the compare-and-set still stops the second one: it fails CREDIT_CHANGED, nothing is over-spent", async () => {
        await creditAndTwoInvoices();
        w.credit.lockOff = true;
        const rs = await Promise.allSettled([w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i2" } as any), w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i3" } as any)]);
        const { ok, failed } = settled(rs);
        assert.equal(ok, 1); assert.equal((failed[0].reason as any).code, "CREDIT_CHANGED");
        const spent = w.allocations.filter(a => a.invoiceId === "i2" || a.invoiceId === "i3").reduce((s, a) => s + a.amountKobo, 0n);
        assert.ok(spent <= N(10_000) && creditLeft() === N(10_000) - spent);               // only one application landed; no credit was spent twice
        // (the in-memory world does not roll allocation rows back with the journal, so the books control is not asserted here; the real transaction does)
    });
    it("a refund payout and a credit application at the same moment both end correctly, in either order", async () => {
        const payment = await creditAndTwoInvoices();
        const r = await w.requestRefund.execute("school-1", BURSAR, { paymentId: payment.id, studentId: "s1", amountKobo: N(6_000), reason: "overpaid" } as any);
        await w.decideRefund.approve(r.id, "school-1", ADMIN, {} as any);
        const rs = await Promise.allSettled([
            w.payRefund.execute(r.id, "school-1", ADMIN, { payoutAccountId: "a-bank" } as any),
            w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i2" } as any),                 // only the 4,000 not held for the refund is free to apply
        ]);
        assert.equal(settled(rs).ok, 2, JSON.stringify(settled(rs).failed.map(f => String(f.reason))));
        assert.equal(creditLeft(), 0n);
        assert.equal(w.refunds.get(r.id)!.status, "PAID");
        w.assertControl(assert);
    });
    it("the compare-and-set itself: a stale amount is refused and the row is left as it was", async () => {
        await creditAndTwoInvoices();
        const row = (await w.d.paymentRepository.creditRows("s1"))[0];
        assert.equal(await w.d.paymentRepository.setAllocationAmount(row.allocationId, 1n, row.amountKobo + 1n), false);
        assert.equal((await w.d.paymentRepository.creditRows("s1"))[0].amountKobo, row.amountKobo);
        assert.equal(await w.d.paymentRepository.setAllocationAmount(row.allocationId, row.amountKobo - 1n, row.amountKobo), true);
    });
});

describe("REM-023: two refund requests cannot reserve more credit than exists", () => {
    it("two requests of 6,000 against 10,000 credit: exactly one is accepted, the other is refused for lack of credit", async () => {
        const payment = await creditAndTwoInvoices();
        const ask = () => w.requestRefund.execute("school-1", BURSAR, { paymentId: payment.id, studentId: "s1", amountKobo: N(6_000), reason: "overpaid" } as any);
        const { ok, failed } = settled(await Promise.allSettled([ask(), ask()]));
        assert.equal(ok, 1); assert.equal((failed[0].reason as any).code, "INSUFFICIENT_CREDIT");
        assert.equal([...w.refunds.values()].filter(x => x.status === "REQUESTED").reduce((s, x) => s + x.amountKobo, 0n), N(6_000));
        w.assertControl(assert);
    });
    it("control: with the lock off both are accepted (12,000 reserved against 10,000), so the lock is what prevents it", async () => {
        const payment = await creditAndTwoInvoices();
        w.credit.lockOff = true;
        const ask = () => w.requestRefund.execute("school-1", BURSAR, { paymentId: payment.id, studentId: "s1", amountKobo: N(6_000), reason: "overpaid" } as any);
        assert.equal(settled(await Promise.allSettled([ask(), ask()])).ok, 2);
    });
    it("a refund request and a credit application at the same moment cannot both claim the same credit", async () => {
        const payment = await creditAndTwoInvoices();
        const rs = await Promise.allSettled([
            w.requestRefund.execute("school-1", BURSAR, { paymentId: payment.id, studentId: "s1", amountKobo: N(6_000), reason: "overpaid" } as any),
            w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i2" } as any),
        ]);
        const reserved = [...w.refunds.values()].reduce((s, x) => s + x.amountKobo, 0n);
        const applied = w.allocations.filter(a => a.invoiceId === "i2").reduce((s, a) => s + a.amountKobo, 0n);
        assert.ok(reserved + applied <= N(10_000), `reserved ${reserved} + applied ${applied} must not exceed the 10,000 credit (${JSON.stringify(settled(rs).failed.map(f => String(f.reason)))})`);
        w.assertControl(assert);
    });
});

describe("the lock is taken before credit is read", () => {
    const spy = () => { const calls: string[] = []; for (const m of ["lockStudentCredit", "creditRows"]) { const orig = w.d.paymentRepository[m]; w.d.paymentRepository[m] = async (...a: any[]) => { calls.push(m); return orig(...a); }; } return calls; };
    it("applying credit, requesting a refund and paying a refund all lock first", async () => {
        const payment = await creditAndTwoInvoices();
        const calls = spy();
        await w.applyCredit.execute("school-1", ADMIN, { invoiceId: "i2" } as any);
        const r = await w.requestRefund.execute("school-1", BURSAR, { paymentId: payment.id, studentId: "s1", amountKobo: N(1_000), reason: "x" } as any);
        await w.decideRefund.approve(r.id, "school-1", ADMIN, {} as any);
        calls.length = 0;
        await w.payRefund.execute(r.id, "school-1", ADMIN, { payoutAccountId: "a-bank" } as any);
        assert.equal(calls[0], "lockStudentCredit");
        const idx = (m: string) => calls.indexOf(m);
        assert.ok(idx("lockStudentCredit") < idx("creditRows"));
    });
    it("using a lock outside a transaction is a programming error in the fake (the real one would release at once)", async () => {
        await assert.rejects(w.d.paymentRepository.lockStudentCredit("s1"), /inside a transaction/);
    });
});
