import { randomUUID } from "node:crypto";
import { IPaymentRepository } from "../repositories/payment.repository";
import { IRefundRepository } from "../repositories/refund.repository";
import { IFeeInvoiceRepository } from "../../fees/repositories/fee-invoice.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { planCreditUse } from "../domain/credit.policy";
import { paymentErrors } from "../domain/payment.errors";
import { CreditRow } from "../domain/payment.entity";
import type { FeeInvoiceEntity } from "../../fees/domain/invoice.entity";

interface Dependencies {
    paymentRepository: IPaymentRepository; refundRepository: IRefundRepository; feeInvoiceRepository: IFeeInvoiceRepository; postingService: PostingService;
}

export interface CreditOptions { now?: () => Date }

/*
| A STUDENT'S CREDIT (brief rule 5). Credit is money paid in advance, held per student as payment allocations with no invoice.
| It is available to apply to an invoice, or to refund. Money already asked to be refunded is not available.
*/
export class CreditService {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: CreditOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async available(studentId: string): Promise<{ rows: CreditRow[]; totalKobo: bigint }> {
        const rows = await this.d.paymentRepository.creditRows(studentId);
        const open = await this.d.refundRepository.openAmounts(studentId);
        const out: CreditRow[] = [];
        for (const r of rows) {
            const held = open.get(r.paymentId) ?? 0n;
            const cut = held < r.amountKobo ? held : r.amountKobo;
            open.set(r.paymentId, held - cut);
            if (r.amountKobo - cut > 0n) out.push({ ...r, availableKobo: r.amountKobo - cut });
        }
        return { rows: out, totalKobo: out.reduce((s, r) => s + r.availableKobo, 0n) };
    }

    /* Use the student's credit on an open invoice: as much as asked (or as much as is owed), oldest payment first.
       Call inside a transaction. Returns what was applied (zero when there was nothing to apply). */
    async applyToInvoice(inv: FeeInvoiceEntity, maxKobo: bigint | undefined, actorUserId: string | null): Promise<bigint> {
        const d = this.d;
        if ((inv.status !== "unpaid" && inv.status !== "partial") || inv.balanceKobo <= 0n) throw paymentErrors.invoiceNotPayable(inv.id);
        const wanted = maxKobo !== undefined && maxKobo < inv.balanceKobo ? maxKobo : inv.balanceKobo;
        const { rows } = await this.available(inv.studentId);
        const takes = planCreditUse(rows, wanted);
        if (takes.length === 0) return 0n;

        const entryDate = todayInFinanceZone(this.now());
        let applied = 0n;
        for (const { row, takeKobo } of takes) {
            await d.postingService.post({
                entryDate, description: `Credit applied to ${inv.invoiceNumber ?? "invoice"}${inv.studentName ? `: ${inv.studentName}` : ""}`,
                sourceType: "PAYMENT", sourceId: row.paymentId, purpose: `APPLY:${randomUUID()}`,
                lines: [
                    { systemKey: "ADVANCE_PAYMENTS", debitKobo: takeKobo, partyType: "STUDENT", partyId: inv.studentId },
                    { systemKey: "FEES_RECEIVABLE", creditKobo: takeKobo, partyType: "STUDENT", partyId: inv.studentId },
                ],
                termId: inv.termId, sessionId: inv.sessionId, branchId: inv.branchId, actorUserId,
            });
            await d.paymentRepository.setAllocationAmount(row.allocationId, row.amountKobo - takeKobo);
            await d.paymentRepository.addAllocations([{ paymentId: row.paymentId, invoiceId: inv.id, studentId: inv.studentId, amountKobo: takeKobo, createdById: actorUserId }]);
            await d.paymentRepository.adjustUnallocated(row.paymentId, -takeKobo);
            applied += takeKobo;
        }
        const status = inv.balanceKobo - applied === 0n ? "paid" : "partial";
        if (!(await d.feeInvoiceRepository.applyPayment(inv.id, inv.version, applied, status))) throw paymentErrors.invoiceChanged(inv.id);
        return applied;
    }
}
