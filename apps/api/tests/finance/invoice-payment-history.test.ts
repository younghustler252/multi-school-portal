import { test } from "node:test";
import assert from "node:assert/strict";
import { InvoicePaymentHistoryUseCase, MyInvoicePaymentHistoryUseCase } from "../../src/modules/payments/usecases/invoice-payment-history.usecases";

const alloc = (id: string, invoiceId: string | null, studentId: string, amt: number, reversedAt: Date | null = null) =>
    ({ id, invoiceId, invoiceNumber: invoiceId ? "INV-" + invoiceId : null, studentId, studentName: "S", amountKobo: BigInt(amt), reversedAt });
const pay = (id: string, o: any = {}) => ({
    id, payerType: "GUARDIAN", guardianId: "g1", payerName: "Ada", payerPhone: null, branchId: null, method: "bank_transfer", amountKobo: 100000n, unallocatedKobo: 0n, accountId: "acc",
    status: "CONFIRMED", reference: "REF-" + id, proofAttachmentId: null, targetStudentIds: [], note: null, paidAt: new Date("2026-10-01T00:00:00Z"), recordedById: "staff1",
    confirmedById: "staff2", confirmedAt: new Date("2026-10-01"), journalId: null, reversedAt: null, version: 1, createdAt: new Date("2026-10-01"), allocations: [], receiptNumber: "R-" + id, ...o,
}) as any;
const P = [
    pay("p1", { allocations: [alloc("a1", "i1", "s1", 60000), alloc("a2", "i2", "s1", 40000)] }),                      // spread over two invoices
    pay("p2", { guardianId: "g9", payerName: "Uncle", allocations: [alloc("a3", "i1", "s1", 25000)] }),                 // another guardian's payment, same child
    pay("p3", { status: "REVERSED", reversedAt: new Date(), allocations: [alloc("a4", "i1", "s1", 5000, new Date())] }), // undone
    pay("p4", { allocations: [alloc("a5", "i7", "s7", 90000)] }),                                                     // another child's invoice
    pay("p5", { status: "AWAITING_CONFIRMATION", allocations: [alloc("a6", "i1", "s1", 1000)] }),                       // not confirmed yet
];
const repo = { listForInvoice: async (id: string) => P.filter(p => p.allocations.some((a: any) => a.invoiceId === id)) } as any;
const ctx = (linked: string[]) => ({ guardianLinkedStudentIds: async () => linked }) as any;

test("staff: only what went to THIS invoice, applied and reversed apart, totals exclude reversed amounts", async () => {
    const r = await new InvoicePaymentHistoryUseCase({ paymentRepository: repo, paymentContextRepository: ctx([]) }).execute("i1");
    assert.deepEqual(r.payments.map(p => [p.id, p.appliedKobo, p.reversedKobo]), [["p1", 60000, 0], ["p2", 25000, 0], ["p3", 0, 5000], ["p5", 1000, 0]]);
    assert.deepEqual(r.totals, { appliedKobo: 86000, reversedKobo: 5000 });
    assert.equal(r.invoiceNumber, "INV-i1");
    assert.equal(r.payments[0].reference, "REF-p1"); assert.equal(r.payments[0].recordedById, "staff1");
});

test("staff: an invoice with no payments is an empty history, and another invoice's payments never appear", async () => {
    const e = await new InvoicePaymentHistoryUseCase({ paymentRepository: repo, paymentContextRepository: ctx([]) }).execute("i404");
    assert.deepEqual(e, { invoiceId: "i404", invoiceNumber: null, totals: { appliedKobo: 0, reversedKobo: 0 }, payments: [] });
    const r = await new InvoicePaymentHistoryUseCase({ paymentRepository: repo, paymentContextRepository: ctx([]) }).execute("i2");
    assert.deepEqual(r.payments.map(p => [p.id, p.appliedKobo]), [["p1", 40000]]);
});

test("guardian: linked child only; confirmed/reversed only; payer sees method and reference, another payer does not", async () => {
    const r = await new MyInvoicePaymentHistoryUseCase({ paymentRepository: repo, paymentContextRepository: ctx(["s1"]) }).execute("i1", "g1");
    assert.deepEqual(r.payments.map(p => p.id), ["p1", "p2", "p3"]);                       // p5 is unconfirmed
    const mine = r.payments[0], theirs = r.payments[1];
    assert.deepEqual([mine.isPayer, mine.method, mine.reference], [true, "bank_transfer", "REF-p1"]);
    assert.deepEqual([theirs.isPayer, theirs.method, theirs.reference], [false, null, null]);
    for (const p of r.payments) { assert.equal((p as any).recordedById, undefined); assert.equal((p as any).confirmedById, undefined); }
    assert.equal(r.totals.appliedKobo, 85000);
});

test("guardian: an unlinked child's invoice looks empty, exactly like an invoice with no payments", async () => {
    const uc = new MyInvoicePaymentHistoryUseCase({ paymentRepository: repo, paymentContextRepository: ctx(["s1"]) });
    const other = await uc.execute("i7", "g1"), none = await uc.execute("i404", "g1");
    assert.deepEqual(other.payments, []); assert.equal(other.invoiceNumber, null); assert.deepEqual(other.totals, none.totals);
    const nolink = await new MyInvoicePaymentHistoryUseCase({ paymentRepository: repo, paymentContextRepository: ctx([]) }).execute("i1", "g1");
    assert.deepEqual(nolink.payments, []);
});
