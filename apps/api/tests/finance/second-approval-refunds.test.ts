import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { feesWorld, N, code } from "./support/fees-world";

let w: ReturnType<typeof feesWorld>;
const ADMIN = "admin-1", BURSAR = "bursar-1", PRINCIPAL = "principal-1";
const on = (thresholdKobo: bigint) => { (w.d as any).financeSettingsService = { get: async () => ({ allowSelfApproval: false, secondApprovalThresholdKobo: thresholdKobo }) }; };
beforeEach(() => { w = feesWorld(); });

async function overpaid() {
    await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
    return (await w.pay({ amountKobo: N(70_000), studentIds: ["s1"] })).payment;
}
const askRefund = (paymentId: string, amount: number) => w.requestRefund.execute("school-1", BURSAR, { paymentId, studentId: "s1", amountKobo: N(amount), reason: "overpaid" } as any);

describe("second approver: refunds", () => {
    it("off by default: one approval is enough", async () => {
        const p = await overpaid(); const r = await askRefund(p.id, 10_000);
        assert.equal((await w.decideRefund.approve(r.id, "school-1", ADMIN, {})).status, "APPROVED");
    });

    it("above the amount the first approval only records; a different person's approval completes it", async () => {
        on(N(5_000));
        const p = await overpaid(); const r = await askRefund(p.id, 10_000);
        const first: any = await w.decideRefund.approve(r.id, "school-1", ADMIN, {});
        assert.equal(first.status, "REQUESTED"); assert.equal(first.approvalsReceived, 1); assert.equal(first.firstApprovedById, ADMIN);
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, { payoutAccountId: "a-bank" } as any), code("REFUND_NOT_APPROVED"));
        await assert.rejects(() => w.decideRefund.approve(r.id, "school-1", ADMIN, {}), code("SECOND_APPROVER_MUST_DIFFER"));
        assert.equal((await w.decideRefund.approve(r.id, "school-1", PRINCIPAL, {})).status, "APPROVED");
        assert.deepEqual(w.audit.map(a => a.action).slice(-3), ["payments.refund.requested", "payments.refund.first_approved", "payments.refund.approved"]);
    });

    it("below the amount one approval is enough; a rejection after a first approval is final", async () => {
        on(N(20_000));
        const p = await overpaid(); const r = await askRefund(p.id, 10_000);
        assert.equal((await w.decideRefund.approve(r.id, "school-1", ADMIN, {})).status, "APPROVED");
        on(N(5_000));
        const p2 = (await w.pay({ amountKobo: N(30_000), studentIds: ["s1"] })).payment; const r2 = await askRefund(p2.id, 10_000);
        await w.decideRefund.approve(r2.id, "school-1", ADMIN, {});
        assert.equal((await w.decideRefund.reject(r2.id, "school-1", PRINCIPAL, { note: "no" })).status, "REJECTED");
    });
});

describe("second approver: fee adjustments", () => {
    const ask = (amount: number) => w.requestAdjustment.execute("school-1", BURSAR, { invoiceId: "i1", type: "WAIVER", amountKobo: N(amount), reason: "hardship" } as any);

    it("above the amount nothing is posted until a different person approves too", async () => {
        on(N(5_000));
        await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
        const req = await ask(10_000);
        const first: any = await w.decideAdjustment.approve(req.id, "school-1", ADMIN, {});
        assert.equal(first.status, "PENDING"); assert.equal(first.approvalsReceived, 1);
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(60_000));
        await assert.rejects(() => w.decideAdjustment.approve(req.id, "school-1", ADMIN, {}), code("SECOND_APPROVER_MUST_DIFFER"));
        assert.equal((await w.decideAdjustment.approve(req.id, "school-1", PRINCIPAL, {})).status, "APPROVED");
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(50_000));
        w.assertControl(assert);
    });

    it("a small adjustment still needs one approval only", async () => {
        on(N(50_000));
        await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
        const req = await ask(1_000);
        assert.equal((await w.decideAdjustment.approve(req.id, "school-1", ADMIN, {})).status, "APPROVED");
    });
});
