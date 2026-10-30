import { IPaymentRepository } from "../repositories/payment.repository";
import { IRefundRepository } from "../repositories/refund.repository";
import { IFeeInvoiceRepository } from "../../fees/repositories/fee-invoice.repository";
import { PostingService, PostLine } from "../../ledger/services/posting.service";
import { PaymentMapper } from "../mappers/payment.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { paymentErrors } from "../domain/payment.errors";
import { ReversePaymentDtoType } from "../dtos/payment.dto";

interface Dependencies {
    paymentRepository: IPaymentRepository; refundRepository: IRefundRepository; feeInvoiceRepository: IFeeInvoiceRepository;
    postingService: PostingService; paymentMapper: PaymentMapper; auditService: AuditService;
}

export interface ReverseOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/*
| REVERSE A PAYMENT (a bounced cheque, money that never arrived, a payment recorded in error). In ONE transaction:
|   - every invoice it paid owes that money again (paid goes down, balance goes up, status follows),
|   - ONE compensating journal: the receivable (and any advance still held) is debited, the money account is credited,
|   - its allocations are closed and the payment is marked reversed.
| The original journal is never edited. A payment that has refunds cannot be reversed: the refund must not have happened.
| It works from the allocations as they stand now, so it stays correct after credit was applied or a credit note moved money to credit.
*/
export class ReversePaymentUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: ReverseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: ReversePaymentDtoType) {
        const d = this.d;
        const p = await d.paymentRepository.findById(id);
        if (!p) throw paymentErrors.paymentNotFound();
        if (p.status !== "CONFIRMED") throw paymentErrors.notConfirmed(p.status);
        if ((await d.refundRepository.countForPayment(id)) > 0) throw paymentErrors.paymentHasRefunds();

        await this.transaction(async () => {
            const live = await d.paymentRepository.allocationsOfPayment(id);
            const perInvoice = new Map<string, bigint>();
            const owed = new Map<string, bigint>();        // receivable to bring back, per student
            const held = new Map<string, bigint>();        // advance still held, per student
            for (const a of live) {
                const bucket = a.invoiceId ? owed : held;
                bucket.set(a.studentId, (bucket.get(a.studentId) ?? 0n) + a.amountKobo);
                if (a.invoiceId) perInvoice.set(a.invoiceId, (perInvoice.get(a.invoiceId) ?? 0n) + a.amountKobo);
            }

            // the invoices owe the money again
            const invoices = await d.feeInvoiceRepository.findManyByIds([...perInvoice.keys()]);
            for (const inv of invoices) {
                const back = perInvoice.get(inv.id) as bigint;
                const paid = inv.paidKobo - back;
                const ok = await d.feeInvoiceRepository.updateAmounts(inv.id, inv.version, {
                    totalKobo: inv.totalKobo, paidKobo: paid, balanceKobo: inv.balanceKobo + back, status: paid === 0n ? "unpaid" : "partial",
                });
                if (!ok) throw paymentErrors.invoiceChanged(inv.id);
            }

            // one compensating journal
            const lines: PostLine[] = [];
            for (const [studentId, sum] of [...owed].sort(([x], [y]) => x.localeCompare(y))) lines.push({ systemKey: "FEES_RECEIVABLE", debitKobo: sum, partyType: "STUDENT", partyId: studentId });
            for (const [studentId, sum] of [...held].sort(([x], [y]) => x.localeCompare(y))) lines.push({ systemKey: "ADVANCE_PAYMENTS", debitKobo: sum, partyType: "STUDENT", partyId: studentId });
            const total = lines.reduce((s, l) => s + (l.debitKobo ?? 0n), 0n);
            if (total !== p.amountKobo) throw paymentErrors.paymentChanged();         // allocations no longer add up to the payment: stop rather than post a wrong entry
            lines.push({ accountId: p.accountId, creditKobo: p.amountKobo });
            await d.postingService.post({
                entryDate: todayInFinanceZone(this.now()), description: `Payment ${p.receiptNumber ?? p.id} reversed: ${dto.reason}`,
                sourceType: "PAYMENT", sourceId: p.id, purpose: "REVERSE", lines, branchId: p.branchId, actorUserId,
            });

            await d.paymentRepository.reverseAllocations(id, this.now());
            const ok = await d.paymentRepository.markReversed(id, p.version, { reversedAt: this.now(), reversedById: actorUserId, reversalReason: dto.reason, unallocatedKobo: 0n });
            if (!ok) throw paymentErrors.paymentChanged();
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.payment.reversed", entity: "Payment", entityId: id,
            oldValue: { status: "CONFIRMED", amountKobo: p.amountKobo.toString() }, newValue: { status: "REVERSED", reason: dto.reason },
        });
        return d.paymentMapper.toResponse((await d.paymentRepository.findById(id))!);
    }
}
