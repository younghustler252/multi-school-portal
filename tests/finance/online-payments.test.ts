/*
|--------------------------------------------------------------------------
| ONLINE PAYMENTS (brief rule 4): start, confirm from the gateway, never twice, the clearing account, settlement.
| The gateway is a small fake; posting is the REAL posting service.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { feesWorld, N, code } from "./support/fees-world";
import { InitializeOnlinePaymentDto, RecordSettlementDto } from "../../src/modules/payments/dtos/payment.dto";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";

let w: ReturnType<typeof feesWorld>;
beforeEach(async () => { w = feesWorld(); await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]); });
const start = (amount?: number, invoiceId = "i1", guardian = "g1") => w.initOnline.execute("school-1", guardian, { invoiceId, amountKobo: amount === undefined ? undefined : N(amount) });
const control = () => w.assertControl(assert);

describe("start an online payment", () => {
    it("saves a PENDING payment pointed at the clearing account, then asks the gateway", async () => {
        const r = await start(20_000);
        const p = w.payments.get(r.paymentId);
        assert.deepEqual([p.status, p.method, p.accountId, p.guardianId, p.targetStudentIds], ["PENDING", "paystack", "a-clearing", "g1", ["s1"]]);
        assert.equal(p.amountKobo, N(20_000));
        assert.match(r.reference, /^PAY-[0-9A-F]{12}$/);
        assert.equal(r.authorizationUrl, `https://pay.test/${r.reference}`);
        const sent = w.provider.started[0];
        assert.deepEqual([sent.email, sent.amountKobo, sent.subaccount, sent.metadata.type, sent.metadata.schoolId, sent.metadata.paymentId], ["parent@example.com", Number(N(20_000)), "ACCT_sub1", "school_fee", "school-1", p.id]);
        assert.equal(w.books.journals.length, 1);                                        // nothing posted yet
    });

    it("defaults to the invoice's balance, and any amount is allowed", async () => {
        assert.equal((await start()).amountKobo, Number(N(60_000)));
        assert.equal((await start(90_000)).amountKobo, Number(N(90_000)));
    });

    it("refuses a child that is not theirs, an invoice that is not open, and a missing invoice", async () => {
        await w.addInvoice("i2", "s2", [["a-tuition", N(1_000)]]);
        w.people.set("s9", "Stranger"); await w.addInvoice("i9", "s9");
        await assert.rejects(() => start(undefined, "i9"), code("NOT_YOUR_CHILD"));
        w.invoices.get("i2")!.status = "paid";
        await assert.rejects(() => start(undefined, "i2"), code("INVOICE_NOT_PAYABLE"));
        await assert.rejects(() => start(undefined, "nope"), code("INVOICE_NOT_PAYABLE"));
        await assert.rejects(() => start(undefined, "i1", "g-unknown"), code("NOT_YOUR_CHILD"));
    });

    it("if the gateway cannot start it, the payment is marked failed at once", async () => {
        w.provider.failToStart = true;
        await assert.rejects(() => start(), code("GATEWAY_ERROR"));
        assert.equal([...w.payments.values()][0].status, "FAILED");
    });

    it("validates the request", () => {
        assert.ok(InitializeOnlinePaymentDto.safeParse({ invoiceId: "i" }).success);
        assert.ok(!InitializeOnlinePaymentDto.safeParse({ invoiceId: "i", amountKobo: 0 }).success);
        assert.ok(!InitializeOnlinePaymentDto.safeParse({ invoiceId: "i", callbackUrl: "nope" }).success);
        assert.ok(!InitializeOnlinePaymentDto.safeParse({}).success);
    });
});

describe("confirm from the gateway", () => {
    it("a part payment: Dr clearing, Cr receivable, receipt, invoice partial, mail sent", async () => {
        const r = await start(20_000);
        const o = await w.confirmOnline.execute(r.reference, "school-1");
        assert.equal(o.state, "confirmed");
        assert.equal(o.payment.status, "CONFIRMED");
        assert.equal(o.payment.receiptNumber, "RCT-2026-000001");
        assert.equal(w.balance("a-clearing"), N(20_000));
        assert.equal(w.balance("a-cash"), 0n);
        assert.equal(w.invoices.get("i1")!.status, "partial");
        assert.equal(w.payments.get(r.paymentId).webhookVerified, true);
        assert.equal(w.audit.at(-1).action, "payments.online.confirmed");
        assert.equal(w.mails[0].to, "parent@example.com");
        assert.equal(w.mails[0].reference, "RCT-2026-000001");
        control();
    });

    it("an overpayment pays the invoice and keeps the rest as credit", async () => {
        const r = await start(75_000);
        await w.confirmOnline.execute(r.reference, "school-1");
        assert.equal(w.invoices.get("i1")!.status, "paid");
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(15_000)));
        control();
    });

    it("the same payment confirmed again, or by two callers at once, posts once", async () => {
        const r = await start(20_000);
        // two callers at once (webhook and return visit): one wins; the other either sees it done or is refused and retried later
        const both = await Promise.allSettled([w.confirmOnline.execute(r.reference, "school-1"), w.confirmOnline.execute(r.reference, "school-1")]);
        assert.equal(both.filter(x => x.status === "fulfilled" && x.value.state === "confirmed").length, 1);
        for (const x of both) if (x.status === "rejected") assert.ok(["INVOICE_CHANGED", "DUPLICATE_POSTING", "PAYMENT_CHANGED"].includes(x.reason.code), x.reason.message);
        assert.equal((await w.confirmOnline.execute(r.reference, "school-1")).state, "already");
        assert.equal(w.books.journals.length, 2);                                        // invoice + one payment
        assert.equal(w.invoices.get("i1")!.paidKobo, N(20_000));
        assert.equal(w.mails.length, 1);
        control();
    });

    it("a different amount from the one asked for is held, not confirmed", async () => {
        const r = await start(20_000);
        w.provider.answer = ref => ({ status: "success", reference: ref, amountKobo: Number(N(19_000)), paidAt: null, channel: "card", customerEmail: "x" });
        await assert.rejects(() => w.confirmOnline.execute(r.reference, "school-1"), code("ONLINE_AMOUNT_MISMATCH"));
        assert.equal(w.payments.get(r.paymentId).status, "PENDING");
        assert.equal(w.audit.at(-1).action, "payments.online.amount_mismatch");
        assert.equal(w.books.journals.length, 1);
    });

    it("failed and abandoned payments are marked failed; a pending one is left alone", async () => {
        const a = await start(), b = await start();
        w.provider.answer = ref => ({ status: "pending", reference: ref, amountKobo: 0, paidAt: null, channel: "", customerEmail: "" });
        assert.equal((await w.confirmOnline.execute(a.reference, "school-1")).state, "pending");
        assert.equal(w.payments.get(a.paymentId).status, "PENDING");
        w.provider.answer = ref => ({ status: "abandoned", reference: ref, amountKobo: 0, paidAt: null, channel: "card", customerEmail: "", gatewayResponse: "Customer left" });
        assert.equal((await w.confirmOnline.execute(b.reference, "school-1")).state, "failed");
        assert.equal(w.payments.get(b.paymentId).status, "FAILED");
        assert.equal((await w.confirmOnline.execute(b.reference, "school-1")).state, "failed");
        assert.equal(w.books.journals.length, 1);
        control();
    });

    it("a guardian can check only their own payment; an unknown or cash reference is not found", async () => {
        const r = await start(5_000);
        await assert.rejects(() => w.confirmOnline.execute(r.reference, "school-1", "g-other"), code("NOT_YOUR_PAYMENT"));
        assert.equal((await w.confirmOnline.execute(r.reference, "school-1", "g1")).state, "confirmed");
        await assert.rejects(() => w.confirmOnline.execute("PAY-NONE", "school-1"), code("NOT_FOUND"));
        const cash = (await w.pay({ studentIds: ["s1"] })).payment;
        await assert.rejects(() => w.confirmOnline.execute(cash.reference ?? "x", "school-1"), code("NOT_FOUND"));
    });

    it("a reversed online payment credits the clearing account back", async () => {
        const r = await start(20_000);
        await w.confirmOnline.execute(r.reference, "school-1");
        await w.reverse.execute(r.paymentId, "school-1", "admin-1", { reason: "Chargeback" });
        assert.equal(w.balance("a-clearing"), 0n);
        control();
    });
});

describe("settlement", () => {
    it("moves the gross out of clearing into the bank, less the gateway's fee", async () => {
        const r1 = await start(20_000), r2 = await start(30_000);
        await w.confirmOnline.execute(r1.reference, "school-1");
        await w.confirmOnline.execute(r2.reference, "school-1");
        assert.equal(w.balance("a-clearing"), N(50_000));
        const s = await w.settle.execute("school-1", "bursar-1", { grossKobo: N(50_000), feeKobo: N(750), reference: "STL-1" });
        assert.equal(s.receivedKobo, Number(N(49_250)));
        assert.equal(w.balance("a-bank"), N(49_250));
        assert.equal(w.balance("a-clearing"), 0n);
        assert.equal(w.audit.at(-1).action, "payments.online.settled");
        const bankCharges = w.books.journals.at(-1)!.lines.length;
        assert.equal(bankCharges, 3);
        control();
    });

    it("the same gateway reference never posts twice; without a fee there are two lines", async () => {
        await w.settle.execute("school-1", "bursar-1", { grossKobo: N(1_000), feeKobo: 0n, reference: "STL-2" });
        const again = await w.settle.execute("school-1", "bursar-1", { grossKobo: N(1_000), feeKobo: 0n, reference: "STL-2" });
        assert.equal(w.books.journals.length, 2);                                        // invoice + one settlement
        assert.equal(w.books.journals.at(-1)!.lines.length, 2);
        assert.ok(again.journalId);
    });

    it("lands in a real bank or money account, and not in the future", async () => {
        await assert.rejects(() => w.settle.execute("school-1", "b", { grossKobo: N(1), feeKobo: 0n, accountId: "a-rent" }), code("SETTLEMENT_INVALID"));
        await assert.rejects(() => w.settle.execute("school-1", "b", { grossKobo: N(1), feeKobo: 0n, accountId: "a-clearing" }), code("SETTLEMENT_INVALID"));
        await assert.rejects(() => w.settle.execute("school-1", "b", { grossKobo: N(1), feeKobo: 0n, accountId: "nope" }), code("SETTLEMENT_INVALID"));
        await assert.rejects(() => w.settle.execute("school-1", "b", { grossKobo: N(1), feeKobo: 0n, settledOn: "2026-12-01" }), code("PAYMENT_DATE_IN_FUTURE"));
    });

    it("validates the request: the fee must be less than the amount", () => {
        assert.ok(RecordSettlementDto.safeParse({ grossKobo: 1000, feeKobo: 10 }).success);
        assert.ok(RecordSettlementDto.safeParse({ grossKobo: 1000 }).success);
        assert.ok(!RecordSettlementDto.safeParse({ grossKobo: 1000, feeKobo: 1000 }).success);
        assert.ok(!RecordSettlementDto.safeParse({ feeKobo: 1 }).success);
    });
});

describe("permissions", () => {
    const granted = (r: string) => ROLE_TEMPLATES.find(t => t.key === r)!.permissions.map(p => p.key);
    it("only guardians pay online (their own children); the bursar records settlements", () => {
        const pay = PERMISSION_REGISTRY.find(p => p.key === "payments.pay")!;
        assert.deepEqual([...pay.personas], ["GUARDIAN"]);
        assert.deepEqual([...pay.scopes], ["OWN"]);
        assert.deepEqual(["student", "guardian", "bursar", "principal", "teacher"].filter(r => granted(r).includes("payments.pay")), ["guardian"]);
        assert.deepEqual([...PERMISSION_REGISTRY.find(p => p.key === "payments.settle")!.personas], ["STAFF"]);
        assert.ok(granted("bursar").includes("payments.settle") && !granted("principal").includes("payments.settle"));
    });
});
