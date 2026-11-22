/*
| PAYMENTS APPLIED TO ONE INVOICE, on a real database.
| Only confirmed payments with a live allocation to THIS invoice; a payment split over two invoices shows the part that went to each;
| a family sees only its own child's issued invoices (everything else is a plain 404).
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { seed } from "../attendance/fixtures";
import { FeeReportRepositoryImpl } from "../../src/modules/fees/repositories/fee-report.repository.impl";
import { InvoicePaymentsUseCase, MyInvoicePaymentsUseCase } from "../../src/modules/fees/usecases/invoice-payments.usecases";

describe("invoice payment history (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    let W: any;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const staff = (id: string) => new InvoicePaymentsUseCase({ feeReportRepository: new FeeReportRepositoryImpl() }).execute(id);
    const family = (v: { persona: string; personaEntityId: string }, id: string) => new MyInvoicePaymentsUseCase({ feeReportRepository: new FeeReportRepositoryImpl() }).execute(v, id);
    const notFound = (e: any) => e?.statusCode === 404;

    before(async () => {
        school = await createTestSchool();
        W = await school.run(async () => {
            const S = await seed();                                        // s1 Ada (G1's child), s4 Dayo
            const d = db();
            const G3 = await d.guardian.create({ data: { firstName: "Tolu", lastName: "Parent", email: "tolu@x.com", phone: "0800Tolu" } });
            await d.studentGuardian.create({ data: { guardianId: G3.id, studentId: S.s4.id, relation: "father", isPrimary: true } });
            const account = await d.ledgerAccount.create({ data: { code: "1000", name: "Cash", type: "ASSET", isMoneyAccount: true } });
            const inv = (studentId: string, status: string, n: string) => d.feeInvoice.create({ data: { studentId, status, invoiceNumber: `INV-${n}`, totalKobo: 500000n, balanceKobo: 500000n } });
            const iA = await inv(S.s1.id, "unpaid", "A"), iB = await inv(S.s1.id, "partial", "B"), iDraft = await inv(S.s1.id, "draft", "D"), iOther = await inv(S.s4.id, "unpaid", "O");
            let n = 0;
            const pay = async (key: string, status: string, covers: [any, any, number, Date | null][]) => {
                n++;
                const p = await d.payment.create({ data: {
                    payerType: "GUARDIAN", guardianId: S.guardian.id, payerName: "Gina Parent", payerPhone: "0800Gina", method: "bank_transfer", amountKobo: BigInt(covers.reduce((s, c) => s + c[2], 0)), unallocatedKobo: 0n,
                    accountId: account.id, status, reference: `REF-${key}`, paidAt: new Date("2026-02-10T00:00:00Z"), createdAt: new Date(Date.UTC(2026, 1, 10, 9, n)),
                    allocations: { create: covers.map(([s, i, k, rev]) => ({ studentId: s.id, invoiceId: i.id, amountKobo: BigInt(k), reversedAt: rev, createdAt: new Date(Date.UTC(2026, 1, 10, 9, n)) })) },
                } });
                if (status === "CONFIRMED") await d.receipt.create({ data: { receiptNumber: `RCT-${key}`, paymentId: p.id, issuedAt: new Date(), snapshot: {} } });
                return p.id as string;
            };
            const split = await pay("SPLIT", "CONFIRMED", [[S.s1, iA, 100000, null], [S.s1, iB, 50000, null]]);     // one payment over two invoices
            const later = await pay("LATER", "CONFIRMED", [[S.s1, iA, 20000, null]]);
            await pay("PENDING", "AWAITING_CONFIRMATION", [[S.s1, iA, 999, null]]);                                // not confirmed: never shown
            await pay("REVERSED", "CONFIRMED", [[S.s1, iA, 777, new Date()]]);                                       // allocation reversed: never shown
            await pay("OTHER", "CONFIRMED", [[S.s4, iOther, 5000, null]]);
            return { S, G3, iA, iB, iDraft, iOther, split, later };
        });
    });
    after(async () => { await school.drop(); });

    it("staff: shows what each payment put on THIS invoice, newest first, with the payment's own total", async () => {
        const a = await school.run(() => staff(W.iA.id));
        assert.deepEqual(a.map(p => [p.paymentId, p.allocatedKobo, p.paymentTotalKobo]), [[W.later, 20000, 20000], [W.split, 100000, 150000]]);
        const b = await school.run(() => staff(W.iB.id));
        assert.deepEqual(b.map(p => [p.paymentId, p.allocatedKobo, p.paymentTotalKobo]), [[W.split, 50000, 150000]]);
        assert.equal(a[1].receiptNumber, "RCT-SPLIT");
    });
    it("staff: pending and reversed money never appears; an invoice with nothing paid is an empty list; an unknown id is 404", async () => {
        const all = await school.run(() => staff(W.iA.id));
        assert.ok(!JSON.stringify(all).includes("REF-PENDING") && !JSON.stringify(all).includes("REF-REVERSED"));
        assert.deepEqual(await school.run(() => staff(W.iDraft.id)), []);
        await assert.rejects(school.run(() => staff("00000000-0000-0000-0000-000000000000")), notFound);
    });
    it("family: a guardian sees the payments on their own child's invoice, without payer identity or reference", async () => {
        const out = await school.run(() => family({ persona: "GUARDIAN", personaEntityId: W.S.guardian.id }, W.iA.id));
        assert.deepEqual(out.map(p => [p.paymentId, p.allocatedKobo]), [[W.later, 20000], [W.split, 100000]]);
        assert.ok(!JSON.stringify(out).match(/REF-|Gina|0800|paymentTotalKobo/));
    });
    it("family: another family's invoice and a draft invoice are 404", async () => {
        await assert.rejects(school.run(() => family({ persona: "GUARDIAN", personaEntityId: W.G3.id }, W.iA.id)), notFound);
        await assert.rejects(school.run(() => family({ persona: "GUARDIAN", personaEntityId: W.S.guardian.id }, W.iOther.id)), notFound);
        await assert.rejects(school.run(() => family({ persona: "GUARDIAN", personaEntityId: W.S.guardian.id }, W.iDraft.id)), notFound);
    });
    it("family: the student themself can read their own invoice's payments", async () => {
        assert.equal((await school.run(() => family({ persona: "STUDENT", personaEntityId: W.S.s1.id }, W.iB.id))).length, 1);
    });
});
