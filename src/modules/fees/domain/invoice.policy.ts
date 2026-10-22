import type { PostLine } from "../../ledger/services/posting.service";
import { FeeStructureEntity } from "./fee.entity";
import { DiscountInput, FeeInvoiceEntity, InvoiceStatus, NewInvoiceDiscount, StudentType } from "./invoice.entity";

/*
| Invoice rules that need no database.
*/

export interface InvoiceTotals { subtotalKobo: bigint; discountKobo: bigint; adjustmentsKobo: bigint; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint }

export function totalsOf(items: { amountKobo: bigint }[], discountKobo: bigint): InvoiceTotals {
    const subtotal = items.reduce((sum, i) => sum + i.amountKobo, 0n);
    const total = subtotal - discountKobo;
    return { subtotalKobo: subtotal, discountKobo, adjustmentsKobo: 0n, totalKobo: total, paidKobo: 0n, balanceKobo: total };
}

/*
| WORK OUT DISCOUNTS. A rule for one fee type takes its share of that fee only; a rule with no fee type takes its share of
| the whole bill. A percentage is worked out on the full amount and rounded DOWN to a whole kobo. A fixed discount is capped
| at what it applies to. Together, discounts can never take more than the subtotal, so an invoice never goes negative.
| Rules are applied in the order given.
*/
export function computeDiscounts(items: { feeTypeId: string | null; amountKobo: bigint }[], rules: DiscountInput[]): { lines: NewInvoiceDiscount[]; totalKobo: bigint } {
    const subtotal = items.reduce((sum, i) => sum + i.amountKobo, 0n);
    const perFee = new Map<string, bigint>();
    for (const i of items) if (i.feeTypeId) perFee.set(i.feeTypeId, (perFee.get(i.feeTypeId) ?? 0n) + i.amountKobo);
    const feeLeft = new Map(perFee);

    let left = subtotal;
    const lines: NewInvoiceDiscount[] = [];
    for (const r of rules) {
        const base = r.feeTypeId ? (perFee.get(r.feeTypeId) ?? 0n) : subtotal;
        if (base <= 0n) continue;
        const raw = r.type === "PERCENT" ? (base * r.value) / 10_000n : r.value;
        const cap = r.feeTypeId ? minOf(feeLeft.get(r.feeTypeId) ?? 0n, left) : left;
        const taken = minOf(raw, cap);
        if (taken <= 0n) continue;
        lines.push({ ruleId: r.ruleId, feeTypeId: r.feeTypeId, label: r.label, amountKobo: taken });
        left -= taken;
        if (r.feeTypeId) feeLeft.set(r.feeTypeId, (feeLeft.get(r.feeTypeId) ?? 0n) - taken);
    }
    return { lines, totalKobo: subtotal - left };
}

const minOf = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/*
| PICK THE STRUCTURE FOR A STUDENT. It must be for the term, and for the student's class (or every class), for the
| campus being billed (or every campus), and for new or returning students (or all). The most specific one wins:
| a class beats "every class", a student type beats "all", a campus beats "every campus".
*/
export function pickStructure(structures: FeeStructureEntity[], who: { classId: string; studentType: StudentType; branchId: string | null }): FeeStructureEntity | null {
    let best: FeeStructureEntity | null = null;
    let bestScore = -1;
    for (const s of structures) {
        if (!s.isActive || s.deletedAt) continue;
        if (s.classId && s.classId !== who.classId) continue;
        if (s.branchId && s.branchId !== who.branchId) continue;
        if (s.studentType !== "ALL" && s.studentType !== who.studentType) continue;
        const score = (s.classId ? 4 : 0) + (s.studentType !== "ALL" ? 2 : 0) + (s.branchId ? 1 : 0);
        if (score > bestScore) { best = s; bestScore = score; }
    }
    return best;
}

/*
| THE JOURNAL FOR AN ISSUED INVOICE (brief rule 1). Debit Fees receivable for what the family owes (party: the student),
| debit Discounts allowed for what the school gives up, credit each fee's income account for its full amount.
| Debits equal credits because subtotal = total + discount.
*/
export function issueLines(inv: Pick<FeeInvoiceEntity, "studentId" | "totalKobo" | "discountKobo" | "items">): PostLine[] {
    const lines: PostLine[] = [];
    if (inv.totalKobo > 0n) lines.push({ systemKey: "FEES_RECEIVABLE", debitKobo: inv.totalKobo, partyType: "STUDENT", partyId: inv.studentId });
    if (inv.discountKobo > 0n) lines.push({ systemKey: "DISCOUNTS_ALLOWED", debitKobo: inv.discountKobo });
    for (const i of inv.items) if (i.amountKobo > 0n) lines.push({ accountId: i.incomeAccountId, creditKobo: i.amountKobo });
    return lines;
}

export const invoiceNumber = (year: string, sequence: number): string => `INV-${year}-${String(sequence).padStart(6, "0")}`;

// A bill that is fully discounted owes nothing the moment it is issued
export const statusAtIssue = (balanceKobo: bigint): InvoiceStatus => (balanceKobo === 0n ? "paid" : "unpaid");
