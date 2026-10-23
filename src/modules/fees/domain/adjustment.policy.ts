import type { PostLine } from "../../ledger/services/posting.service";
import { feeErrors } from "./fee.errors";
import { AdjustmentType } from "./adjustment.entity";
import { FeeInvoiceEntity, InvoiceItemEntity } from "./invoice.entity";

/* Until the settings service exists (finance.allow_self_approval): the person who asked for an adjustment cannot approve it. */
export const ALLOW_SELF_APPROVAL = false;

export interface AdjustmentPlan {
    adjustmentsKobo: bigint; discountKobo: bigint; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint;
    status: "unpaid" | "partial" | "paid" | "waived";
    excessKobo: bigint;                         // credit note only: money already paid that is now more than the invoice, turned into the student's credit
    extraDiscountKobo: bigint;                  // additional discount only: the line to show on the invoice
    lines: PostLine[];
}

export interface PlanInput {
    type: AdjustmentType; amountKobo: bigint;
    item: InvoiceItemEntity | null;             // credit note only
    creditedBefore: bigint;                     // credit notes already approved on that item
}

const REASON_ACCOUNT = { WAIVER: "DISCOUNTS_ALLOWED", WRITE_OFF: "BAD_DEBT", ADDITIONAL_DISCOUNT: "DISCOUNTS_ALLOWED" } as const;

/*
| WHAT AN ADJUSTMENT DOES to an issued invoice and to the books (brief rules 6 and 7). Pure: no saving.
|   waiver / extra discount   the school gives up part of what is still owed:   Dr discounts allowed, Cr receivable
|   write-off                 the school accepts it will not be paid:           Dr bad debt, Cr receivable
|   credit note               a charge is cancelled:                            Dr that fee's income, Cr receivable
|                             if that leaves the student overpaid, the overpaid part is not receivable any more,
|                             so it is credited to advance payments instead (and becomes the student's credit).
| Waiver, write-off and extra discount can never be more than the invoice still owes. A credit note can never be more
| than the fee it cancels (less earlier credit notes on it), nor more than the invoice's total.
*/
export function planAdjustment(inv: FeeInvoiceEntity, p: PlanInput): AdjustmentPlan {
    const x = p.amountKobo;
    if (x <= 0n) throw feeErrors.adjustmentAmountInvalid();

    if (p.type !== "CREDIT_NOTE") {
        if (inv.status !== "unpaid" && inv.status !== "partial") throw feeErrors.adjustmentInvoiceState(inv.status);
        if (x > inv.balanceKobo) throw feeErrors.adjustmentTooLarge(inv.balanceKobo);
        const isDiscount = p.type === "ADDITIONAL_DISCOUNT";
        const balance = inv.balanceKobo - x;
        return {
            adjustmentsKobo: isDiscount ? inv.adjustmentsKobo : inv.adjustmentsKobo - x, discountKobo: isDiscount ? inv.discountKobo + x : inv.discountKobo,
            totalKobo: inv.totalKobo - x, paidKobo: inv.paidKobo, balanceKobo: balance, status: statusAfter(balance, inv.paidKobo), excessKobo: 0n,
            extraDiscountKobo: isDiscount ? x : 0n,
            lines: [{ systemKey: REASON_ACCOUNT[p.type], debitKobo: x }, { systemKey: "FEES_RECEIVABLE", creditKobo: x, partyType: "STUDENT", partyId: inv.studentId }],
        };
    }

    // credit note
    if (inv.status !== "unpaid" && inv.status !== "partial" && inv.status !== "paid") throw feeErrors.adjustmentInvoiceState(inv.status);
    if (!p.item) throw feeErrors.creditNoteItemRequired();
    const room = p.item.amountKobo - p.creditedBefore;
    if (x > room) throw feeErrors.creditNoteTooLarge(room);
    if (x > inv.totalKobo) throw feeErrors.adjustmentTooLarge(inv.totalKobo);

    const total = inv.totalKobo - x;
    const excess = inv.paidKobo > total ? inv.paidKobo - total : 0n;
    const paid = inv.paidKobo - excess;
    const balance = total - paid;
    const lines: PostLine[] = [{ accountId: p.item.incomeAccountId, debitKobo: x }];
    if (x - excess > 0n) lines.push({ systemKey: "FEES_RECEIVABLE", creditKobo: x - excess, partyType: "STUDENT", partyId: inv.studentId });
    if (excess > 0n) lines.push({ systemKey: "ADVANCE_PAYMENTS", creditKobo: excess, partyType: "STUDENT", partyId: inv.studentId });
    return {
        adjustmentsKobo: inv.adjustmentsKobo - x, discountKobo: inv.discountKobo, totalKobo: total, paidKobo: paid, balanceKobo: balance,
        status: statusAfter(balance, paid), excessKobo: excess, extraDiscountKobo: 0n, lines,
    };
}

function statusAfter(balance: bigint, paid: bigint): "unpaid" | "partial" | "paid" | "waived" {
    if (balance === 0n) return paid > 0n ? "paid" : "waived";
    return paid > 0n ? "partial" : "unpaid";
}

export const ADJUSTMENT_LABEL: Record<AdjustmentType, string> = {
    WAIVER: "Waiver", WRITE_OFF: "Write-off", CREDIT_NOTE: "Credit note", ADDITIONAL_DISCOUNT: "Extra discount",
};
