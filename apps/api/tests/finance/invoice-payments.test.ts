import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InvoicePaymentsUseCase, MyInvoicePaymentsUseCase } from "../../src/modules/fees/usecases/invoice-payments.usecases";

const row = (o: Record<string, unknown> = {}) => ({
    paymentId: "p1", allocatedKobo: 150_000n, allocatedAt: new Date("2026-03-02T10:00:00Z"), method: "bank_transfer", status: "CONFIRMED", reference: "TRF-9",
    paidAt: new Date("2026-03-01T00:00:00Z"), paymentCreatedAt: new Date("2026-03-01T09:00:00Z"), paymentTotalKobo: 400_000n, receiptNumber: "RCT-0001", ...o,
}) as any;

function repo(o: { invoice?: any; rows?: any[]; kids?: string[] } = {}) {
    const calls = { payments: 0 };
    return {
        calls,
        feeReportRepository: {
            invoiceForPayments: async () => ("invoice" in o ? o.invoice : { id: "i1", studentId: "kid1", status: "unpaid" }),
            invoicePayments: async () => { calls.payments++; return o.rows ?? [row()]; },
            childIdsOf: async () => o.kids ?? ["kid1"],
        } as any,
    };
}
const guardian = { persona: "GUARDIAN", personaEntityId: "g1" };

describe("staff: payments applied to an invoice", () => {
    it("returns the amount applied to THIS invoice next to the payment's own total", async () => {
        const out = await new InvoicePaymentsUseCase(repo()).execute("i1");
        assert.deepEqual(out, [{ paymentId: "p1", receiptNumber: "RCT-0001", method: "bank_transfer", status: "CONFIRMED", reference: "TRF-9", paidOn: "2026-03-01",
            recordedAt: new Date("2026-03-01T09:00:00Z"), allocatedKobo: 150000, paymentTotalKobo: 400000 }]);
    });
    it("keeps the order the repository gives (newest first) and a payment with no paid date shows null", async () => {
        const out = await new InvoicePaymentsUseCase(repo({ rows: [row({ paymentId: "b", paidAt: null }), row({ paymentId: "a" })] })).execute("i1");
        assert.deepEqual(out.map(p => [p.paymentId, p.paidOn]), [["b", null], ["a", "2026-03-01"]]);
    });
    it("an invoice with no payments is an empty list; an unknown invoice is 404 and nothing else is read", async () => {
        assert.deepEqual(await new InvoicePaymentsUseCase(repo({ rows: [] })).execute("i1"), []);
        const r = repo({ invoice: null });
        await assert.rejects(new InvoicePaymentsUseCase(r).execute("nope"), (e: any) => e.statusCode === 404);
        assert.equal(r.calls.payments, 0);
    });
    it("money beyond the safe integer range is a digit string, like the rest of the fees API", async () => {
        const big = BigInt(Number.MAX_SAFE_INTEGER) + 10n;
        const out = await new InvoicePaymentsUseCase(repo({ rows: [row({ allocatedKobo: big })] })).execute("i1");
        assert.equal(out[0].allocatedKobo, big.toString());
    });
});

describe("family: payments applied to my child's invoice", () => {
    it("shows invoice facts only: no payer, reference, notes or payment total", async () => {
        const out = await new MyInvoicePaymentsUseCase(repo()).execute(guardian, "i1");
        assert.deepEqual(out, [{ paymentId: "p1", receiptNumber: "RCT-0001", method: "bank_transfer", status: "CONFIRMED", paidOn: "2026-03-01", allocatedKobo: 150000 }]);
        for (const k of ["reference", "paymentTotalKobo", "payerName", "payerPhone", "note", "guardianId", "recordedAt"]) assert.ok(!(k in out[0]), k);
    });
    it("a student sees their own invoice's payments", async () => {
        assert.equal((await new MyInvoicePaymentsUseCase(repo({ kids: ["kid1"] })).execute({ persona: "STUDENT", personaEntityId: "kid1" }, "i1")).length, 1);
    });
    it("another family's invoice, a draft and a void invoice are all plain 404, and payments are never read", async () => {
        for (const invoice of [{ id: "i1", studentId: "other", status: "unpaid" }, { id: "i1", studentId: "kid1", status: "draft" }, { id: "i1", studentId: "kid1", status: "void" }, null]) {
            const r = repo({ invoice });
            await assert.rejects(new MyInvoicePaymentsUseCase(r).execute(guardian, "i1"), (e: any) => e.statusCode === 404 && e.code !== "NOT_YOUR_CHILD");
            assert.equal(r.calls.payments, 0);
        }
    });
    it("a session with no family link (staff, or a guardian with no children) gets 404", async () => {
        await assert.rejects(new MyInvoicePaymentsUseCase(repo()).execute({ persona: "STAFF", personaEntityId: "s1" }, "i1"), (e: any) => e.statusCode === 404);
        await assert.rejects(new MyInvoicePaymentsUseCase(repo({ kids: [] })).execute(guardian, "i1"), (e: any) => e.statusCode === 404);
    });
    it("paid, partial and overdue invoices are all visible (only draft and void are hidden)", async () => {
        for (const status of ["unpaid", "partial", "paid", "overdue"]) {
            assert.equal((await new MyInvoicePaymentsUseCase(repo({ invoice: { id: "i1", studentId: "kid1", status } })).execute(guardian, "i1")).length, 1, status);
        }
    });
});
