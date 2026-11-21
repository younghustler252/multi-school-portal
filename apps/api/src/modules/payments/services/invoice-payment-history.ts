import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import type { PaymentEntity } from "../domain/payment.entity";

/*
| PAYMENT HISTORY OF ONE INVOICE: every payment that was applied to it, newest first, with what went to THIS invoice
| (a payment can also cover other invoices or become credit).
|   appliedKobo   live allocations to this invoice          reversedKobo   allocations later undone (a reversed payment, a returned credit)
|   totals        applied across the rows (never counts reversed amounts)
| Money is whole kobo as a JSON number (a digit string only when too large to be safe), like every other payment response. Payments that were never applied to the invoice (pending or failed online attempts) are not listed.
|
| Two audiences:
|   staff   (payments.view)  the full row: payer, method, reference, who recorded and confirmed it
|   family  (payments.pay)   a guardian sees it only for a child they are linked to; the payer sees the method and reference, anyone else
|                            only their child's share and nothing about the payer's account or reference.
*/
export interface InvoicePaymentRow {
    id: string; status: string; method: string | null; paidOn: string | null; createdAt: Date; receiptNumber: string | null;
    appliedKobo: number | string; reversedKobo: number | string; reversedAt: Date | null;
    payerType?: string; payerName?: string | null; reference?: string | null; recordedById?: string | null; confirmedById?: string | null; confirmedAt?: Date | null;
    isPayer?: boolean;
}
export interface InvoicePaymentHistory { invoiceId: string; invoiceNumber: string | null; totals: { appliedKobo: number | string; reversedKobo: number | string }; payments: InvoicePaymentRow[] }

const sums = (p: PaymentEntity, invoiceId: string) => {
    let applied = 0n, reversed = 0n;
    for (const a of p.allocations) {
        if (a.invoiceId !== invoiceId) continue;
        if (a.reversedAt) reversed += a.amountKobo; else applied += a.amountKobo;
    }
    return { applied, reversed };
};

export function staffInvoiceHistory(invoiceId: string, payments: PaymentEntity[]): InvoicePaymentHistory {
    let applied = 0n, reversed = 0n; let invoiceNumber: string | null = null;
    const rows: InvoicePaymentRow[] = [];
    for (const p of payments) {
        const s = sums(p, invoiceId);
        const alloc = p.allocations.find(a => a.invoiceId === invoiceId);
        if (!alloc) continue;
        invoiceNumber ??= alloc.invoiceNumber;
        applied += s.applied; reversed += s.reversed;
        rows.push({
            id: p.id, status: p.status, method: p.method, paidOn: p.paidAt ? dayOut(p.paidAt) : null, createdAt: p.createdAt, receiptNumber: p.receiptNumber,
            appliedKobo: koboOut(s.applied), reversedKobo: koboOut(s.reversed), reversedAt: p.reversedAt,
            payerType: p.payerType, payerName: p.payerName, reference: p.reference, recordedById: p.recordedById, confirmedById: p.confirmedById, confirmedAt: p.confirmedAt,
        });
    }
    return { invoiceId, invoiceNumber, totals: { appliedKobo: koboOut(applied), reversedKobo: koboOut(reversed) }, payments: rows };
}

/** A guardian sees the history only when the invoice belongs to a linked child; otherwise it looks empty (an unlinked invoice is not confirmed to exist). */
export function familyInvoiceHistory(invoiceId: string, payments: PaymentEntity[], guardianId: string, childIds: ReadonlySet<string>): InvoicePaymentHistory {
    const mine = payments.filter(p => p.status === "CONFIRMED" || p.status === "REVERSED")
        .filter(p => p.allocations.some(a => a.invoiceId === invoiceId && childIds.has(a.studentId)));
    let applied = 0n, reversed = 0n; let invoiceNumber: string | null = null;
    const rows: InvoicePaymentRow[] = [];
    for (const p of mine) {
        const s = sums(p, invoiceId);
        invoiceNumber ??= p.allocations.find(a => a.invoiceId === invoiceId)?.invoiceNumber ?? null;
        applied += s.applied; reversed += s.reversed;
        const isPayer = p.guardianId === guardianId;
        rows.push({
            id: p.id, status: p.status, method: isPayer ? p.method : null, paidOn: p.paidAt ? dayOut(p.paidAt) : null, createdAt: p.createdAt, receiptNumber: p.receiptNumber,
            appliedKobo: koboOut(s.applied), reversedKobo: koboOut(s.reversed), reversedAt: p.reversedAt,
            isPayer, payerName: p.payerName, reference: isPayer ? p.reference : null,
        });
    }
    return { invoiceId, invoiceNumber, totals: { appliedKobo: koboOut(applied), reversedKobo: koboOut(reversed) }, payments: rows };
}
