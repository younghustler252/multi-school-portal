/*
|--------------------------------------------------------------------------
| PHASE 2 ACCEPTANCE STORY (brief section 12): "generate, issue, part-pay online and in cash, overpay, apply credit, waive, credit-note and refund,
| reverse a payment; the receivable control always equals the open invoices." One school, followed step by step over the real posting service,
| with the control checked after every step.
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { feesWorld, N } from "./support/fees-world";

const ADMIN = "admin-1", BURSAR = "bursar-1";

describe("phase 2 acceptance story", () => {
    it("a term of fees from issue to reversal keeps the books and the invoices in step", async () => {
        const w = feesWorld();
        const control = () => w.assertControl(assert);
        const inv = (id: string) => w.invoices.get(id)!;

        // 1. two issued invoices
        await w.addInvoice("i1", "s1", [["a-tuition", N(60_000)]]);
        await w.addInvoice("i2", "s2", [["a-tuition", N(30_000)], ["a-books", N(10_000)]]);
        assert.equal(w.balance("a-recv"), N(100_000));
        control();

        // 2. a part payment in cash
        const cash = (await w.pay({ amountKobo: N(25_000), studentIds: ["s1"] })).payment;
        assert.equal(inv("i1").balanceKobo, N(35_000));
        assert.equal(inv("i1").status, "partial");
        control();

        // 3. a part payment online, then the gateway pays the school: clearing empties into the bank, less the fee
        const started = await w.initOnline.execute("school-1", "g1", { invoiceId: "i1", amountKobo: N(15_000) });
        assert.equal((await w.confirmOnline.execute(started.reference, "school-1")).state, "confirmed");
        assert.equal(inv("i1").balanceKobo, N(20_000));
        assert.equal(w.balance("a-clearing"), N(15_000));
        await w.settle.execute("school-1", BURSAR, { grossKobo: N(15_000), feeKobo: N(225), reference: "STL-ACCEPT" });
        assert.equal(w.balance("a-clearing"), 0n);
        assert.equal(w.balance("a-fees"), N(225));
        control();

        // 4. an overpayment: the invoice is cleared and the rest is the student's credit
        await w.pay({ amountKobo: N(50_000), studentIds: ["s1"] });
        assert.equal(inv("i1").balanceKobo, 0n);
        assert.equal(inv("i1").status, "paid");
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(30_000)));
        assert.equal(w.balance("a-advance"), -N(30_000));
        control();

        // 5. a waiver on the second invoice: asked by the bursar, approved by someone else
        const waiver = await w.requestAdjustment.execute("school-1", BURSAR, { invoiceId: "i2", type: "WAIVER", amountKobo: N(10_000), reason: "Staff child" });
        await w.decideAdjustment.approve(waiver.id, "school-1", ADMIN, {});
        assert.equal(inv("i2").totalKobo, N(30_000));
        control();

        // 6. s1's credit pays the second invoice (credit is per student, so it goes to s1's own invoice: give s1 another)
        await w.addInvoice("i3", "s1", [["a-tuition", N(30_000)], ["a-books", N(5_000)]]);
        assert.equal(inv("i3").balanceKobo, N(35_000));
        const applied = await w.applyCredit.execute("school-1", BURSAR, { invoiceId: "i3" });
        assert.equal(applied.appliedKobo, Number(N(30_000)));
        assert.equal(inv("i3").balanceKobo, N(5_000));
        assert.equal(w.balance("a-advance"), 0n);
        control();

        // 7. a credit note on a fully paid invoice: the fee is cancelled and the money already paid for it becomes credit
        await w.pay({ amountKobo: N(5_000), studentIds: ["s1"] });
        assert.equal(inv("i3").status, "paid");
        const booksItem = inv("i3").items.find(i => i.incomeAccountId === "a-books")!;
        const note = await w.requestAdjustment.execute("school-1", BURSAR, { invoiceId: "i3", type: "CREDIT_NOTE", invoiceItemId: booksItem.id, amountKobo: N(5_000), reason: "Books not supplied" });
        await w.decideAdjustment.approve(note.id, "school-1", ADMIN, {});
        assert.equal(inv("i3").totalKobo, N(30_000));
        assert.equal((await w.getCredit.execute("s1")).totalKobo, Number(N(5_000)));
        control();

        // 8. a refund of that credit: ask, approve (not by the same person), pay out
        const holder = [...w.payments.values()].find(p => p.unallocatedKobo > 0n)!;
        const refund = await w.requestRefund.execute("school-1", BURSAR, { paymentId: holder.id, studentId: "s1", amountKobo: N(5_000), reason: "Books not supplied" });
        await w.decideRefund.approve(refund.id, "school-1", ADMIN, {});
        assert.equal((await w.payRefund.execute(refund.id, "school-1", ADMIN, {})).status, "PAID");
        assert.equal((await w.getCredit.execute("s1")).totalKobo, 0);
        assert.equal(w.balance("a-advance"), 0n);
        control();

        // 9. the first cash payment was a mistake: reverse it, and the invoice owes that money again
        const before = inv("i1").balanceKobo;
        await w.reverse.execute(cash.id, "school-1", ADMIN, { reason: "Recorded on the wrong child" });
        assert.equal(inv("i1").balanceKobo, before + N(25_000));
        assert.notEqual(inv("i1").status, "paid");
        control();

        // every journal in the story balances
        for (const j of w.books.journals) {
            const dr = j.lines.reduce((s: bigint, l: any) => s + l.debitKobo, 0n), cr = j.lines.reduce((s: bigint, l: any) => s + l.creditKobo, 0n);
            assert.equal(dr, cr);
        }
    });
});
