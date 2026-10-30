/*
|--------------------------------------------------------------------------
| FEES v2, money moving after an invoice exists: advance credit, adjustments (waiver, write-off, extra discount, credit note),
| refunds and payment reversal. Every test ends by checking the control: fees receivable equals the open invoice balances.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { feesWorld, N, code } from "./support/fees-world";
import { planAdjustment } from "../../src/modules/fees/domain/adjustment.policy";
import { planCreditUse } from "../../src/modules/payments/domain/credit.policy";
import { RequestAdjustmentDto } from "../../src/modules/fees/dtos/adjustment.dto";
import { RequestRefundDto, PayRefundDto, ReversePaymentDto } from "../../src/modules/payments/dtos/payment.dto";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";

let w: ReturnType<typeof feesWorld>;
beforeEach(() => { w = feesWorld(); });
const ADMIN = "admin-1", BURSAR = "bursar-1";
const control = () => w.assertControl(assert);

// A student who paid 70,000 against a 60,000 invoice holds 10,000 credit
async function overpaid() {
    await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
    const { payment } = await w.pay({ amountKobo: N(70_000), studentIds: ["s1"] });
    return payment;
}

describe("credit policy", () => {
    const row = (paymentId: string, available: bigint) => ({ allocationId: `al-${paymentId}`, paymentId, receiptNumber: null, amountKobo: available, availableKobo: available });
    it("uses the oldest payment first and stops at the amount needed", () => {
        const t = planCreditUse([row("a", N(5)), row("b", N(5)), row("c", N(5))], N(7));
        assert.deepEqual(t.map(x => [x.row.paymentId, x.takeKobo]), [["a", N(5)], ["b", N(2)]]);
    });
    it("takes what there is when the need is bigger, and nothing when there is no credit", () => {
        assert.equal(planCreditUse([row("a", N(5))], N(50)).reduce((s, x) => s + x.takeKobo, 0n), N(5));
        assert.deepEqual(planCreditUse([], N(5)), []);
        assert.deepEqual(planCreditUse([row("a", 0n)], N(5)), []);
    });
});

describe("applying a student's credit", () => {
    it("moves credit onto an open invoice: advance payments down, receivable down, the books balance", async () => {
        await overpaid();
        await w.addInvoice("i2", "s1", [["a-tuition", N(30_000)]]);
        const r = await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2" });
        assert.equal(r.appliedKobo, Number(N(10_000)));
        assert.equal(r.balanceKobo, Number(N(20_000)));
        assert.equal(r.status, "partial");
        assert.equal((await w.getCredit.execute("s1")).totalKobo, 0);
        assert.equal(w.payments.get("pay-1").unallocatedKobo, 0n);
        assert.equal(w.audit.at(-1).action, "payments.credit.applied");
        control();
    });

    it("can apply less than is available, and never more than the invoice owes", async () => {
        await overpaid();
        await w.addInvoice("i2", "s1", [["a-tuition", N(4_000)]]);
        await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2", amountKobo: N(1_000) });
        assert.equal(w.invoices.get("i2")!.balanceKobo, N(3_000));
        const r = await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2" });
        assert.equal(r.appliedKobo, Number(N(3_000)));                                  // capped by what the invoice owes
        assert.equal(r.status, "paid");
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(6_000)));
        control();
    });

    it("uses the oldest payment's credit first", async () => {
        await w.pay({ amountKobo: N(3_000), studentIds: ["s1"] });                         // nothing owing: all credit
        await w.pay({ amountKobo: N(5_000), studentIds: ["s1"] });
        await w.addInvoice("i2", "s1", [["a-tuition", N(4_000)]]);
        await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2" });
        assert.equal(w.payments.get("pay-1").unallocatedKobo, 0n);
        assert.equal(w.payments.get("pay-2").unallocatedKobo, N(4_000));
        control();
    });

    it("refuses when there is no credit, or the invoice is not open, or is unknown", async () => {
        await w.addInvoice("i2", "s1", [["a-tuition", N(1_000)]]);
        await assert.rejects(() => w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2" }), code("NOTHING_TO_APPLY"));
        await overpaid();
        w.invoices.get("i1")!.status = "paid";
        await assert.rejects(() => w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i1" }), code("INVOICE_NOT_PAYABLE"));
        await assert.rejects(() => w.applyCredit.execute("school-1", BURSAR, { invoiceId: "nope" }), code("NOT_FOUND"));
        await assert.rejects(() => w.getCredit.execute("nobody"), code("NOT_FOUND"));
    });

    it("credit already asked to be refunded is not available to apply", async () => {
        const p = await overpaid();
        await w.requestRefund.execute("school-1", BURSAR, { paymentId: p.id, studentId: "s1", amountKobo: N(6_000), reason: "Left school" });
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(4_000)));
        await w.addInvoice("i2", "s1", [["a-tuition", N(30_000)]]);
        const r = await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2" });
        assert.equal(r.appliedKobo, Number(N(4_000)));
        control();
    });

    it("issuing a new invoice uses the student's credit at once", async () => {
        await overpaid();
        const draft = { ...(await w.addInvoice("i3", "s1", [["a-tuition", N(30_000)]])), status: "draft" as const, invoiceNumber: null, journalId: null, issueDate: null };
        w.books.journals.pop();                                                         // addInvoice posted it; a draft has no journal yet
        w.invoices.set("i3", draft);
        w.d.feeInvoiceRepository.markIssued = async (id: string, version: number, data: any) => { const i = w.invoices.get(id)!; if (i.version !== version) return false; Object.assign(i, data, { version: version + 1 }); return true; };
        await w.issue.execute("i3", "school-1", ADMIN, { issueDate: "2026-10-20" });
        const inv = w.invoices.get("i3")!;
        assert.equal(inv.status, "partial");
        assert.equal(inv.paidKobo, N(10_000));
        assert.equal(inv.balanceKobo, N(20_000));
        assert.equal(w.audit.at(-1).newValue.creditAppliedKobo, N(10_000).toString());
        control();
    });
});

describe("adjustment maths", () => {
    const inv = (over: any = {}) => ({
        id: "i", studentId: "s1", status: "partial", subtotalKobo: N(60_000), discountKobo: 0n, adjustmentsKobo: 0n, totalKobo: N(60_000), paidKobo: N(20_000), balanceKobo: N(40_000),
        items: [], ...over,
    }) as any;
    const item = { id: "it", feeTypeId: null, description: "Tuition", incomeAccountId: "a-tuition", amountKobo: N(50_000), sortOrder: 0 };

    it("waiver and write-off lower the total and the balance; extra discount raises the discount instead", () => {
        const w1 = planAdjustment(inv(), { type: "WAIVER", amountKobo: N(10_000), item: null, creditedBefore: 0n });
        assert.deepEqual([w1.adjustmentsKobo, w1.totalKobo, w1.balanceKobo, w1.status], [-N(10_000), N(50_000), N(30_000), "partial"]);
        const d1 = planAdjustment(inv(), { type: "ADDITIONAL_DISCOUNT", amountKobo: N(10_000), item: null, creditedBefore: 0n });
        assert.deepEqual([d1.adjustmentsKobo, d1.discountKobo, d1.totalKobo, d1.balanceKobo], [0n, N(10_000), N(50_000), N(30_000)]);
        const x = planAdjustment(inv(), { type: "WRITE_OFF", amountKobo: N(40_000), item: null, creditedBefore: 0n });
        assert.deepEqual([x.balanceKobo, x.status], [0n, "paid"]);
    });

    it("waiving everything on an invoice nobody paid makes it waived", () => {
        const p = planAdjustment(inv({ paidKobo: 0n, balanceKobo: N(60_000), status: "unpaid" }), { type: "WAIVER", amountKobo: N(60_000), item: null, creditedBefore: 0n });
        assert.equal(p.status, "waived");
    });

    it("waiver, write-off and extra discount cannot exceed the balance", () => {
        for (const type of ["WAIVER", "WRITE_OFF", "ADDITIONAL_DISCOUNT"] as const)
            assert.throws(() => planAdjustment(inv(), { type, amountKobo: N(40_001), item: null, creditedBefore: 0n }), code("ADJUSTMENT_EXCEEDS_BALANCE"));
        assert.throws(() => planAdjustment(inv({ status: "paid" }), { type: "WAIVER", amountKobo: 1n, item: null, creditedBefore: 0n }), code("ADJUSTMENT_INVOICE_STATE"));
    });

    it("a credit note that leaves the student overpaid sends the excess to advance payments", () => {
        const p = planAdjustment(inv(), { type: "CREDIT_NOTE", amountKobo: N(50_000), item, creditedBefore: 0n });
        assert.equal(p.totalKobo, N(10_000));
        assert.equal(p.excessKobo, N(10_000));                                           // paid 20,000 against a new total of 10,000
        assert.equal(p.paidKobo, N(10_000));
        assert.equal(p.balanceKobo, 0n);
        assert.equal(p.status, "paid");
        const sum = (k: "debitKobo" | "creditKobo") => p.lines.reduce((s, l) => s + (l[k] ?? 0n), 0n);
        assert.equal(sum("debitKobo"), sum("creditKobo"));
        assert.deepEqual(p.lines.map(l => [l.accountId ?? l.systemKey, l.debitKobo ?? l.creditKobo]), [["a-tuition", N(50_000)], ["FEES_RECEIVABLE", N(40_000)], ["ADVANCE_PAYMENTS", N(10_000)]]);
    });

    it("a credit note within what is unpaid touches only the receivable", () => {
        const p = planAdjustment(inv(), { type: "CREDIT_NOTE", amountKobo: N(30_000), item, creditedBefore: 0n });
        assert.deepEqual([p.excessKobo, p.balanceKobo, p.status, p.lines.length], [0n, N(10_000), "partial", 2]);
    });

    it("a credit note cannot exceed the fee it cancels (less earlier ones) or the invoice total, and must name the fee", () => {
        assert.throws(() => planAdjustment(inv(), { type: "CREDIT_NOTE", amountKobo: N(50_001), item, creditedBefore: 0n }), code("CREDIT_NOTE_EXCEEDS_ITEM"));
        assert.throws(() => planAdjustment(inv(), { type: "CREDIT_NOTE", amountKobo: N(20_000), item, creditedBefore: N(40_000) }), code("CREDIT_NOTE_EXCEEDS_ITEM"));
        assert.throws(() => planAdjustment(inv({ totalKobo: N(10_000), balanceKobo: N(0), paidKobo: N(10_000), discountKobo: N(50_000) }), { type: "CREDIT_NOTE", amountKobo: N(20_000), item, creditedBefore: 0n }), code("ADJUSTMENT_EXCEEDS_BALANCE"));
        assert.throws(() => planAdjustment(inv(), { type: "CREDIT_NOTE", amountKobo: 1n, item: null, creditedBefore: 0n }), code("CREDIT_NOTE_ITEM_REQUIRED"));
    });
});

describe("adjustments end to end", () => {
    const ask = (invoiceId: string, type: any, amount: number, extra: any = {}) =>
        w.requestAdjustment.execute("school-1", BURSAR, { invoiceId, type, amountKobo: N(amount), reason: "Agreed with the principal", ...extra });
    const approve = (id: string, by = ADMIN) => w.decideAdjustment.approve(id, "school-1", by, {});

    it("a waiver waits for approval, then posts Dr discounts allowed, Cr receivable", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
        const req = await ask("i1", "WAIVER", 20_000);
        assert.equal(req.status, "PENDING");
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(60_000));                        // nothing yet
        assert.equal(w.balance("a-disc"), 0n);
        const done = await approve(req.id);
        assert.equal(done.status, "APPROVED");
        const inv = w.invoices.get("i1")!;
        assert.deepEqual([inv.adjustmentsKobo, inv.totalKobo, inv.balanceKobo, inv.status], [-N(20_000), N(40_000), N(40_000), "unpaid"]);
        assert.equal(w.balance("a-disc"), N(20_000));
        assert.deepEqual(w.audit.map(a => a.action).slice(-2), ["fees.adjustment.requested", "fees.adjustment.approved"]);
        control();
    });

    it("the person who asked cannot approve; someone else can; a decided request cannot be decided again", async () => {
        await w.addInvoice("i1", "s1");
        const req = await ask("i1", "WAIVER", 1_000);
        await assert.rejects(() => approve(req.id, BURSAR), code("SELF_APPROVAL_NOT_ALLOWED"));
        await approve(req.id);
        await assert.rejects(() => approve(req.id), code("ADJUSTMENT_NOT_PENDING"));
        await assert.rejects(() => w.decideAdjustment.reject(req.id, "school-1", ADMIN, { note: "no" }), code("ADJUSTMENT_NOT_PENDING"));
        await assert.rejects(() => approve("nope"), code("NOT_FOUND"));
    });

    it("a rejected request changes nothing", async () => {
        await w.addInvoice("i1", "s1");
        const req = await ask("i1", "WRITE_OFF", 5_000);
        const r = await w.decideAdjustment.reject(req.id, "school-1", ADMIN, { note: "Not agreed" });
        assert.equal(r.status, "REJECTED");
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(60_000));
        assert.equal(w.books.journals.length, 1);
        control();
    });

    it("a write-off posts to bad debt", async () => {
        await w.addInvoice("i1", "s1");
        await approve((await ask("i1", "WRITE_OFF", 60_000)).id);
        assert.equal(w.balance("a-bad"), N(60_000));
        assert.equal(w.invoices.get("i1")!.status, "waived");
        control();
    });

    it("an extra discount raises the discount and shows as a line on the invoice", async () => {
        await w.addInvoice("i1", "s1");
        await approve((await ask("i1", "ADDITIONAL_DISCOUNT", 6_000)).id);
        const inv = w.invoices.get("i1")!;
        assert.deepEqual([inv.discountKobo, inv.adjustmentsKobo, inv.totalKobo], [N(6_000), 0n, N(54_000)]);
        assert.equal(inv.discounts.length, 1);
        assert.equal(w.balance("a-disc"), N(6_000));
        control();
    });

    it("a credit note cancels one fee: Dr that fee's income account, Cr receivable", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(50_000)], ["a-books", N(10_000)]]);
        const books = w.invoices.get("i1")!.items[1];
        await approve((await ask("i1", "CREDIT_NOTE", 10_000, { invoiceItemId: books.id })).id);
        assert.equal(w.balance("a-books"), 0n);                                         // income cancelled
        assert.equal(w.balance("a-tuition"), -N(50_000));
        assert.equal(w.invoices.get("i1")!.totalKobo, N(50_000));
        control();
    });

    it("credit notes on one fee add up to no more than the fee", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(50_000)]]);
        const it = w.invoices.get("i1")!.items[0].id;
        await approve((await ask("i1", "CREDIT_NOTE", 30_000, { invoiceItemId: it })).id);
        await assert.rejects(() => ask("i1", "CREDIT_NOTE", 30_000, { invoiceItemId: it }), code("CREDIT_NOTE_EXCEEDS_ITEM"));
        await approve((await ask("i1", "CREDIT_NOTE", 20_000, { invoiceItemId: it })).id);
        assert.equal(w.invoices.get("i1")!.totalKobo, 0n);
        assert.equal(w.invoices.get("i1")!.status, "waived");
        control();
    });

    it("a credit note on a paid invoice turns the overpaid part into credit (then it can be refunded)", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(50_000)], ["a-books", N(10_000)]]);
        const { payment } = await w.pay({ amountKobo: N(60_000), studentIds: ["s1"] });
        assert.equal(w.invoices.get("i1")!.status, "paid");
        const tuition = w.invoices.get("i1")!.items[0].id;
        await approve((await ask("i1", "CREDIT_NOTE", 50_000, { invoiceItemId: tuition })).id);
        const inv = w.invoices.get("i1")!;
        assert.deepEqual([inv.totalKobo, inv.paidKobo, inv.balanceKobo, inv.status], [N(10_000), N(10_000), 0n, "paid"]);
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(50_000)));
        assert.equal(w.payments.get(payment.id).unallocatedKobo, N(50_000));
        assert.equal(-w.balance("a-advance"), N(50_000));
        control();

        const refund = await w.requestRefund.execute("school-1", BURSAR, { paymentId: payment.id, studentId: "s1", amountKobo: N(50_000), reason: "Credit note refund" });
        await w.decideRefund.approve(refund.id, "school-1", ADMIN, {});
        const paid = await w.payRefund.execute(refund.id, "school-1", ADMIN, {});
        assert.equal(paid.status, "PAID");
        assert.equal(w.balance("a-cash"), N(10_000));                                    // 60,000 in, 50,000 back out
        assert.equal(w.payments.get(payment.id).unallocatedKobo, 0n);
        control();
    });

    it("refuses an adjustment on a draft or void invoice, an item from another invoice, and a fee on a waiver", async () => {
        await w.addInvoice("i1", "s1");
        await w.addInvoice("i2", "s2");
        w.invoices.get("i2")!.status = "void";
        await assert.rejects(() => ask("i2", "WAIVER", 1), code("ADJUSTMENT_INVOICE_STATE"));
        await assert.rejects(() => ask("nope", "WAIVER", 1), code("NOT_FOUND"));
        await assert.rejects(() => ask("i1", "CREDIT_NOTE", 1, { invoiceItemId: w.invoices.get("i2")!.items[0].id }), code("ITEM_NOT_ON_INVOICE"));
    });

    it("an invoice with an approved adjustment cannot be voided", async () => {
        await w.addInvoice("i1", "s1");
        await approve((await ask("i1", "ADDITIONAL_DISCOUNT", 1_000)).id);
        await assert.rejects(() => w.voider.execute("i1", "school-1", ADMIN, { reason: "x" }), code("INVOICE_HAS_ADJUSTMENTS"));
    });

    it("a stale approval is checked again against the invoice as it is now", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(10_000)]]);
        const a = await ask("i1", "WAIVER", 8_000);
        const b = await ask("i1", "WAIVER", 8_000);
        await approve(a.id);
        await assert.rejects(() => approve(b.id), code("ADJUSTMENT_EXCEEDS_BALANCE"));
        control();
    });

    it("validates requests", () => {
        const ok = { invoiceId: "i", type: "WAIVER", amountKobo: 5, reason: "r" };
        assert.ok(RequestAdjustmentDto.safeParse(ok).success);
        assert.ok(!RequestAdjustmentDto.safeParse({ ...ok, type: "CREDIT_NOTE" }).success);
        assert.ok(RequestAdjustmentDto.safeParse({ ...ok, type: "CREDIT_NOTE", invoiceItemId: "x" }).success);
        assert.ok(!RequestAdjustmentDto.safeParse({ ...ok, invoiceItemId: "x" }).success);
        assert.ok(!RequestAdjustmentDto.safeParse({ ...ok, amountKobo: 0 }).success);
        assert.ok(!RequestAdjustmentDto.safeParse({ ...ok, extra: 1 }).success);
    });
});

describe("refunds", () => {
    const ask = (paymentId: string, amount: number, studentId = "s1") => w.requestRefund.execute("school-1", BURSAR, { paymentId, studentId, amountKobo: N(amount), reason: "Left the school" });

    it("pays credit back in three steps: ask, approve, pay out (Dr advance payments, Cr the money account)", async () => {
        const p = await overpaid();
        const r = await ask(p.id, 10_000);
        assert.equal(r.status, "REQUESTED");
        assert.equal(w.books.journals.length, 2);                                        // invoice, payment: nothing posted by asking
        const approved = await w.decideRefund.approve(r.id, "school-1", ADMIN, {});
        assert.equal(approved.status, "APPROVED");
        const paid = await w.payRefund.execute(r.id, "school-1", ADMIN, { paidOn: "2026-10-20" });
        assert.equal(paid.status, "PAID");
        assert.equal(paid.payoutAccountId, "a-cash");                                   // the account the payment landed in
        assert.equal(w.balance("a-cash"), N(60_000));                                    // 70,000 in, 10,000 out
        assert.equal(w.balance("a-advance"), 0n);
        assert.equal(w.payments.get(p.id).unallocatedKobo, 0n);
        assert.equal((await w.getCredit.execute("s1")).totalKobo, 0);
        assert.deepEqual(w.audit.map(a => a.action).slice(-3), ["payments.refund.requested", "payments.refund.approved", "payments.refund.paid"]);
        control();
    });

    it("only credit can be refunded, and not twice", async () => {
        const p = await overpaid();
        await assert.rejects(() => ask(p.id, 10_001), code("INSUFFICIENT_CREDIT"));
        await ask(p.id, 6_000);
        await assert.rejects(() => ask(p.id, 4_001), code("INSUFFICIENT_CREDIT"));        // 6,000 is already asked for
        await ask(p.id, 4_000);
        await assert.rejects(() => ask(p.id, 1, "s2"), code("INSUFFICIENT_CREDIT"));       // another student holds none of it
    });

    it("a payment that is not confirmed, or a student that does not exist, is refused", async () => {
        await overpaid();
        w.payments.get("pay-1").status = "AWAITING_CONFIRMATION";
        await assert.rejects(() => ask("pay-1", 1), code("PAYMENT_NOT_CONFIRMED"));
        w.payments.get("pay-1").status = "CONFIRMED";
        await assert.rejects(() => ask("pay-1", 1, "nobody"), code("STUDENT_NOT_FOUND"));
        await assert.rejects(() => ask("nope", 1), code("NOT_FOUND"));
    });

    it("the person who asked cannot approve; a rejected refund frees the credit again", async () => {
        const p = await overpaid();
        const r = await ask(p.id, 10_000);
        await assert.rejects(() => w.decideRefund.approve(r.id, "school-1", BURSAR, {}), code("SELF_APPROVAL_NOT_ALLOWED"));
        assert.equal((await w.getCredit.execute("s1")).totalKobo, 0);
        await w.decideRefund.reject(r.id, "school-1", ADMIN, { note: "Keep it for next term" });
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(10_000)));
        await assert.rejects(() => w.decideRefund.approve(r.id, "school-1", ADMIN, {}), code("REFUND_NOT_REQUESTED"));
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, {}), code("REFUND_NOT_APPROVED"));
        control();
    });

    it("pay-out is only for an approved refund, once, from a real money account, not dated in the future", async () => {
        const p = await overpaid();
        const r = await ask(p.id, 10_000);
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, {}), code("REFUND_NOT_APPROVED"));
        await w.decideRefund.approve(r.id, "school-1", ADMIN, {});
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, { payoutAccountId: "a-rent" }), code("PAYMENT_ACCOUNT_INVALID"));
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, { payoutAccountId: "a-clearing" }), code("PAYMENT_ACCOUNT_INVALID"));
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, { paidOn: "2026-12-01" }), code("PAYMENT_DATE_IN_FUTURE"));
        const paid = await w.payRefund.execute(r.id, "school-1", ADMIN, { payoutAccountId: "a-bank" });
        assert.equal(paid.payoutAccountId, "a-bank");
        assert.equal(w.balance("a-bank"), -N(10_000));
        await assert.rejects(() => w.payRefund.execute(r.id, "school-1", ADMIN, {}), code("REFUND_NOT_APPROVED"));
        control();
    });

    it("a refund of an online payment is paid from the bank, never from the clearing account", async () => {
        const p = await overpaid();
        w.payments.get(p.id).accountId = "a-clearing";
        const r = await ask(p.id, 5_000);
        await w.decideRefund.approve(r.id, "school-1", ADMIN, {});
        assert.equal((await w.payRefund.execute(r.id, "school-1", ADMIN, {})).payoutAccountId, "a-bank");
    });

    it("validates requests", () => {
        assert.ok(RequestRefundDto.safeParse({ paymentId: "p", studentId: "s", amountKobo: 5, reason: "r" }).success);
        assert.ok(!RequestRefundDto.safeParse({ paymentId: "p", studentId: "s", amountKobo: 0, reason: "r" }).success);
        assert.ok(!RequestRefundDto.safeParse({ paymentId: "p", amountKobo: 5, reason: "r" }).success);
        assert.ok(PayRefundDto.safeParse({}).success && !PayRefundDto.safeParse({ paidOn: "yesterday" }).success);
        assert.ok(!ReversePaymentDto.safeParse({}).success);
    });
});

describe("reversing a payment", () => {
    it("puts the money back on the invoices and posts one compensating journal", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
        const { payment } = await w.pay({ amountKobo: N(50_000), studentIds: ["s1"] });
        assert.equal(w.invoices.get("i1")!.status, "partial");
        const before = w.books.journals.length;
        const r = await w.reverse.execute(payment.id, "school-1", ADMIN, { reason: "Cheque bounced" });
        assert.equal(r.status, "REVERSED");
        const inv = w.invoices.get("i1")!;
        assert.deepEqual([inv.status, inv.paidKobo, inv.balanceKobo], ["unpaid", 0n, N(60_000)]);
        assert.equal(w.books.journals.length, before + 1);
        assert.equal(w.balance("a-cash"), 0n);
        assert.equal(w.allocations.filter(a => !a.reversedAt).length, 0);
        assert.equal(w.audit.at(-1).action, "payments.payment.reversed");
        control();
    });

    it("also takes back the advance a payment created", async () => {
        const p = await overpaid();
        await w.reverse.execute(p.id, "school-1", ADMIN, { reason: "Recorded twice" });
        assert.equal(w.balance("a-advance"), 0n);
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(60_000));
        assert.equal((await w.getCredit.execute("s1")).totalKobo, 0);
        control();
    });

    it("works after credit from that payment was applied to another invoice", async () => {
        const p = await overpaid();
        await w.addInvoice("i2", "s1", [["a-tuition", N(30_000)]]);
        await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i2" });
        await w.reverse.execute(p.id, "school-1", ADMIN, { reason: "Bounced" });
        assert.equal(w.invoices.get("i2")!.paidKobo, 0n);
        assert.equal(w.invoices.get("i1")!.paidKobo, 0n);
        assert.equal(w.balance("a-cash"), 0n);
        control();
    });

    it("works after a credit note moved part of it to credit", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(50_000)], ["a-books", N(10_000)]]);
        const { payment } = await w.pay({ amountKobo: N(60_000), studentIds: ["s1"] });
        const req = await w.requestAdjustment.execute("school-1", BURSAR, { invoiceId: "i1", type: "CREDIT_NOTE", invoiceItemId: w.invoices.get("i1")!.items[0].id, amountKobo: N(50_000), reason: "Withdrawn" });
        await w.decideAdjustment.approve(req.id, "school-1", ADMIN, {});
        await w.reverse.execute(payment.id, "school-1", ADMIN, { reason: "Bounced" });
        assert.equal(w.invoices.get("i1")!.paidKobo, 0n);
        assert.equal(w.invoices.get("i1")!.balanceKobo, N(10_000));                      // the cancelled fee stays cancelled
        assert.equal(w.balance("a-cash"), 0n);
        assert.equal(w.balance("a-advance"), 0n);
        control();
    });

    it("refuses a payment that is not confirmed, one already reversed, and one with refunds", async () => {
        const p = await overpaid();
        const r = await w.requestRefund.execute("school-1", BURSAR, { paymentId: p.id, studentId: "s1", amountKobo: N(1_000), reason: "x" });
        await assert.rejects(() => w.reverse.execute(p.id, "school-1", ADMIN, { reason: "x" }), code("PAYMENT_HAS_REFUNDS"));
        await w.decideRefund.reject(r.id, "school-1", ADMIN, { note: "no" });             // a rejected refund no longer blocks
        await w.reverse.execute(p.id, "school-1", ADMIN, { reason: "x" });
        await assert.rejects(() => w.reverse.execute(p.id, "school-1", ADMIN, { reason: "x" }), code("PAYMENT_NOT_CONFIRMED"));
        await assert.rejects(() => w.reverse.execute("nope", "school-1", ADMIN, { reason: "x" }), code("NOT_FOUND"));
        control();
    });
});

describe("the whole story (phase 2 acceptance, without the online leg)", () => {
    it("generate, issue, part-pay, overpay, apply credit, waive, credit-note, refund, reverse: the control holds at every step", async () => {
        await w.addInvoice("i1", "s1", [["a-tuition", N(50_000)], ["a-books", N(10_000)]]);
        await w.addInvoice("i2", "s2", [["a-tuition", N(40_000)]]);
        control();

        const part = (await w.pay({ amountKobo: N(20_000), studentIds: ["s1"] })).payment;               control();
        await w.pay({ amountKobo: N(100_000), method: "pos", studentIds: ["s1", "s2"], creditStudentId: "s1" }); control();
        assert.equal(w.invoices.get("i1")!.status, "paid");
        assert.equal(w.invoices.get("i2")!.status, "paid");
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(20_000)));

        await w.addInvoice("i3", "s1", [["a-tuition", N(25_000)]]);
        await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i3" });                           control();
        assert.equal(w.invoices.get("i3")!.balanceKobo, N(5_000));

        const waiver = await w.requestAdjustment.execute("school-1", BURSAR, { invoiceId: "i3", type: "WAIVER", amountKobo: N(5_000), reason: "Staff child" });
        await w.decideAdjustment.approve(waiver.id, "school-1", ADMIN, {});                              control();
        assert.equal(w.invoices.get("i3")!.status, "paid");

        const note = await w.requestAdjustment.execute("school-1", BURSAR, { invoiceId: "i1", type: "CREDIT_NOTE", invoiceItemId: w.invoices.get("i1")!.items[1].id, amountKobo: N(10_000), reason: "Books supplied by parent" });
        await w.decideAdjustment.approve(note.id, "school-1", ADMIN, {});                                control();
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(10_000)));

        const refundFrom = [...w.payments.values()].find(p => w.allocations.some(a => a.paymentId === p.id && a.invoiceId === null && a.studentId === "s1"))!;
        const refund = await w.requestRefund.execute("school-1", BURSAR, { paymentId: refundFrom.id, studentId: "s1", amountKobo: N(10_000), reason: "Refund of books" });
        await w.decideRefund.approve(refund.id, "school-1", ADMIN, {});
        await w.payRefund.execute(refund.id, "school-1", ADMIN, {});                                     control();

        await w.reverse.execute(part.id, "school-1", ADMIN, { reason: "Bounced" });                      control();
        assert.equal(w.invoices.get("i1")!.status, "partial");
    });
});

describe("permissions", () => {
    const granted = (r: string) => ROLE_TEMPLATES.find(t => t.key === r)!.permissions.map(p => p.key);
    const keys = ["fees.adjustments.request", "fees.adjustments.approve", "payments.refund.request", "payments.refund.approve", "payments.reverse"];

    it("the new keys are staff only, and approving, paying out and reversing are sensitive", () => {
        for (const k of keys) assert.deepEqual([...PERMISSION_REGISTRY.find(p => p.key === k)!.personas], ["STAFF"], k);
        for (const k of ["fees.adjustments.approve", "payments.refund.approve", "payments.reverse"]) assert.equal(PERMISSION_REGISTRY.find(p => p.key === k)!.isSensitive, true, k);
    });

    it("the bursar can ask but never approve or reverse; families get none", () => {
        assert.deepEqual(keys.filter(k => granted("bursar").includes(k)), ["fees.adjustments.request", "payments.refund.request"]);
        for (const r of ["student", "guardian", "teacher"]) assert.ok(!granted(r).some(k => keys.includes(k)));
    });
});
