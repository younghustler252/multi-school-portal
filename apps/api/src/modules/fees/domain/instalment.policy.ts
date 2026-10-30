import { feeErrors } from "./fee.errors";
import { dayString } from "../../ledger/domain/ledger.dates";
import { daysOverdue } from "./report.policy";

export const MAX_INSTALMENTS = 24;

export interface PlanLineInput { dueDate: string; amountKobo: bigint }
export interface PlanLine { lineNumber: number; dueDate: Date; amountKobo: bigint }
export type LineStatus = "PAID" | "PARTIAL" | "UPCOMING" | "OVERDUE";
export interface LineView { lineNumber: number; dueDate: string; amountKobo: bigint; paidKobo: bigint; balanceKobo: bigint; status: LineStatus; daysOverdue: number }

/*
| AN INSTALMENT PLAN splits what an invoice owes into dated parts. It moves no money and posts nothing: payments still go to the invoice,
| oldest first, and each part is simply covered in order. Rules: two to 24 parts, each above zero, dates strictly increasing,
| and the parts add up to exactly what the invoice still owes (its balance) PLUS what is already paid, i.e. its total.
*/
export function validatePlan(lines: PlanLineInput[], totalKobo: bigint): void {
    if (lines.length < 2) throw feeErrors.instalmentsInvalid("A plan needs at least two parts");
    if (lines.length > MAX_INSTALMENTS) throw feeErrors.instalmentsInvalid(`A plan can have at most ${MAX_INSTALMENTS} parts`);
    let previous = "";
    for (const l of lines) {
        if (l.amountKobo <= 0n) throw feeErrors.instalmentsInvalid("Every part must be above zero");
        if (l.dueDate <= previous) throw feeErrors.instalmentsInvalid("Due dates must be in order, one after the other");
        previous = l.dueDate;
    }
    const sum = lines.reduce((s, l) => s + l.amountKobo, 0n);
    if (sum !== totalKobo) throw feeErrors.instalmentsInvalid("The parts must add up to the invoice total", { sumKobo: sum.toString(), totalKobo: totalKobo.toString() });
}

/* Where each part stands: money paid covers the parts in order. If the invoice total has since gone down (an adjustment), the last parts shrink. */
export function scheduleOf(lines: PlanLine[], paidKobo: bigint, totalKobo: bigint, asOf: string): LineView[] {
    let room = totalKobo, paidLeft = paidKobo;
    return [...lines].sort((a, b) => a.lineNumber - b.lineNumber).map(l => {
        const amount = l.amountKobo < room ? l.amountKobo : room > 0n ? room : 0n;
        room -= amount;
        const paid = paidLeft < amount ? paidLeft : amount;
        paidLeft -= paid;
        const due = dayString(l.dueDate);
        const late = daysOverdue(asOf, l.dueDate, null);
        const status: LineStatus = paid === amount ? "PAID" : late > 0 ? "OVERDUE" : paid > 0n ? "PARTIAL" : "UPCOMING";
        return { lineNumber: l.lineNumber, dueDate: due, amountKobo: amount, paidKobo: paid, balanceKobo: amount - paid, status, daysOverdue: status === "OVERDUE" ? late : 0 };
    });
}
