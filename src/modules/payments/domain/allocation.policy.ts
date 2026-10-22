import { paymentErrors } from "./payment.errors";
import { AllocationPlan, OpenInvoice, PlannedAllocation } from "./payment.entity";

/*
| HOW A PAYMENT IS APPLIED (brief 8.4). By default the oldest unpaid invoice first (by due date, no due date last, then by issue
| date, then by number). An allocation never exceeds what the invoice owes, the allocations never exceed the payment, and whatever
| is left becomes credit for one student (an advance, held until it is used or refunded).
*/

const time = (d: Date | null): number => (d ? d.getTime() : Number.POSITIVE_INFINITY);

export function oldestFirst(invoices: OpenInvoice[]): OpenInvoice[] {
    return [...invoices].sort((a, b) =>
        time(a.dueDate) - time(b.dueDate) || time(a.issueDate) - time(b.issueDate) || (a.invoiceNumber ?? "").localeCompare(b.invoiceNumber ?? "") || a.id.localeCompare(b.id));
}

// Which student holds the credit: the one asked for, else the student of the last invoice paid, else the first student on the payment
function creditHolder(requested: string | undefined, targetStudentIds: string[], paid: PlannedAllocation[]): string | null {
    if (requested) {
        if (!targetStudentIds.includes(requested) && !paid.some(p => p.studentId === requested)) throw paymentErrors.creditStudentInvalid();
        return requested;
    }
    return paid.length > 0 ? paid[paid.length - 1].studentId : targetStudentIds[0] ?? null;
}

export function planAllocation(amountKobo: bigint, open: OpenInvoice[], targetStudentIds: string[], creditStudentId?: string): AllocationPlan {
    let left = amountKobo;
    const invoices: PlannedAllocation[] = [];
    for (const inv of oldestFirst(open)) {
        if (left <= 0n) break;
        if (inv.balanceKobo <= 0n) continue;
        const take = left < inv.balanceKobo ? left : inv.balanceKobo;
        invoices.push({ invoiceId: inv.id, studentId: inv.studentId, amountKobo: take });
        left -= take;
    }
    const holder = creditHolder(creditStudentId, targetStudentIds, invoices);
    if (left > 0n && !holder) throw paymentErrors.studentsRequired();
    return { invoices, creditKobo: left, creditStudentId: left > 0n ? holder : null };
}

/* The bursar chose exactly where the money goes. Same limits; the rest is credit. */
export function planOverride(
    amountKobo: bigint, requested: { invoiceId: string; amountKobo: bigint }[], open: OpenInvoice[], targetStudentIds: string[], creditStudentId?: string,
): AllocationPlan {
    const byId = new Map(open.map(i => [i.id, i]));
    const seen = new Set<string>();
    const invoices: PlannedAllocation[] = [];
    let total = 0n;
    for (const r of requested) {
        if (seen.has(r.invoiceId)) throw paymentErrors.allocationDuplicate();
        seen.add(r.invoiceId);
        const inv = byId.get(r.invoiceId);
        if (!inv) throw paymentErrors.allocationInvoiceNotOpen(r.invoiceId);
        if (r.amountKobo > inv.balanceKobo) throw paymentErrors.allocationOverBalance(inv.id, inv.balanceKobo);
        invoices.push({ invoiceId: inv.id, studentId: inv.studentId, amountKobo: r.amountKobo });
        total += r.amountKobo;
    }
    if (total > amountKobo) throw paymentErrors.allocationOverPayment(amountKobo, total);
    const left = amountKobo - total;
    const holder = creditHolder(creditStudentId, targetStudentIds, invoices);
    if (left > 0n && !holder) throw paymentErrors.studentsRequired();
    return { invoices, creditKobo: left, creditStudentId: left > 0n ? holder : null };
}

/* How a manual payment starts (brief 8.4): cash and POS are confirmed when recorded; transfers, cheques and the rest wait for a second person. */
export const CONFIRMED_ON_RECORDING: ReadonlySet<string> = new Set(["cash", "pos"]);
export const NEEDS_REFERENCE: ReadonlySet<string> = new Set(["bank_transfer", "cheque"]);
