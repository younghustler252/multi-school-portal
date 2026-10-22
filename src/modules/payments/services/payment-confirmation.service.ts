import { IPaymentRepository, NewAllocation } from "../repositories/payment.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { IFeeInvoiceRepository } from "../../fees/repositories/fee-invoice.repository";
import { PostingService, PostLine } from "../../ledger/services/posting.service";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { dayString, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { paymentErrors } from "../domain/payment.errors";
import { planAllocation, planOverride } from "../domain/allocation.policy";
import { AllocationPlan, OpenInvoice, PaymentEntity, ReceiptSnapshot } from "../domain/payment.entity";
import type { FeeInvoiceEntity } from "../../fees/domain/invoice.entity";

interface Dependencies {
    paymentRepository: IPaymentRepository; paymentContextRepository: IPaymentContextRepository; feeInvoiceRepository: IFeeInvoiceRepository;
    postingService: PostingService; numberSequenceService: NumberSequenceService;
}

// Replaced in tests only (container injection passes just the first argument)
export interface ConfirmationOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export interface ConfirmContext {
    actorUserId: string | null; schoolId: string;
    allocations?: { invoiceId: string; amountKobo: bigint }[];      // the bursar's own split; oldest first when omitted
    creditStudentId?: string;
}

export interface PlanPreview { plan: AllocationPlan; invoices: Map<string, FeeInvoiceEntity> }

// Loaded on first use so that importing this file never needs a database connection
const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

const asOpen = (i: FeeInvoiceEntity): OpenInvoice => ({ id: i.id, studentId: i.studentId, invoiceNumber: i.invoiceNumber, dueDate: i.dueDate, issueDate: i.issueDate, balanceKobo: i.balanceKobo, version: i.version });

/*
| CONFIRM A PAYMENT (brief rules 2 and 3, section 8.4). In ONE transaction:
|   1. work out where the money goes (oldest invoice first, or the bursar's own split; the rest is credit),
|   2. move each invoice's balance to paid (a version check stops two payments racing on one invoice),
|   3. take the receipt number, post the journal (money account in; receivable and advance payments out),
|   4. save the allocations, mark the payment confirmed, and freeze the receipt.
| If any step fails nothing is kept, not even the receipt number. Used for cash and POS when recorded, and for transfers and
| cheques when a second person confirms. The online path (gateway) will use the same method.
*/
export class PaymentConfirmationService {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: ConfirmationOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    /* The students a payment is for: the ones named on it, else the paying guardian's linked children. */
    async targetsOf(p: Pick<PaymentEntity, "targetStudentIds" | "guardianId">): Promise<string[]> {
        if (p.targetStudentIds.length > 0) return p.targetStudentIds;
        return p.guardianId ? this.d.paymentContextRepository.guardianChildIds(p.guardianId) : [];
    }

    /* Where the money would go, without saving anything. Also what confirmation uses. */
    async plan(amountKobo: bigint, targetStudentIds: string[], override?: { invoiceId: string; amountKobo: bigint }[], creditStudentId?: string): Promise<PlanPreview> {
        const repo = this.d.feeInvoiceRepository;
        if (override) {
            const found = (await repo.findManyByIds(override.map(o => o.invoiceId))).filter(i => (i.status === "unpaid" || i.status === "partial") && i.balanceKobo > 0n);
            return { plan: planOverride(amountKobo, override, found.map(asOpen), targetStudentIds, creditStudentId), invoices: new Map(found.map(i => [i.id, i])) };
        }
        const open = await repo.findOpenForStudents(targetStudentIds);
        return { plan: planAllocation(amountKobo, open.map(asOpen), targetStudentIds, creditStudentId), invoices: new Map(open.map(i => [i.id, i])) };
    }

    async confirm(paymentId: string, ctx: ConfirmContext): Promise<PaymentEntity> {
        const d = this.d;
        return this.transaction(async () => {
            const p = await d.paymentRepository.findById(paymentId);
            if (!p) throw paymentErrors.paymentNotFound();
            if (p.status !== "PENDING" && p.status !== "AWAITING_CONFIRMATION") throw paymentErrors.notWaiting(p.status);

            const targets = await this.targetsOf(p);
            const { plan, invoices } = await this.plan(p.amountKobo, targets, ctx.allocations, ctx.creditStudentId);
            const before = new Map([...invoices].map(([id, inv]) => [id, { balanceKobo: inv.balanceKobo, invoiceNumber: inv.invoiceNumber }]));   // as they were, for the receipt

            // 2. the invoices
            for (const a of plan.invoices) {
                const inv = invoices.get(a.invoiceId)!;
                const status = before.get(inv.id)!.balanceKobo - a.amountKobo === 0n ? "paid" : "partial";
                if (!(await d.feeInvoiceRepository.applyPayment(inv.id, inv.version, a.amountKobo, status))) throw paymentErrors.invoiceChanged(inv.id);
            }

            // 3. the receipt number and the journal
            const paidOn = p.paidAt ? dayString(p.paidAt) : todayInFinanceZone(this.now());
            const year = paidOn.slice(0, 4);
            const receiptNumber = `RCT-${year}-${String(await d.numberSequenceService.next("receipt", year)).padStart(6, "0")}`;

            const perStudent = new Map<string, bigint>();
            for (const a of plan.invoices) perStudent.set(a.studentId, (perStudent.get(a.studentId) ?? 0n) + a.amountKobo);
            const lines: PostLine[] = [{ accountId: p.accountId, debitKobo: p.amountKobo }];
            for (const [studentId, sum] of [...perStudent].sort(([x], [y]) => x.localeCompare(y))) {
                lines.push({ systemKey: "FEES_RECEIVABLE", creditKobo: sum, partyType: "STUDENT", partyId: studentId });
            }
            if (plan.creditKobo > 0n) lines.push({ systemKey: "ADVANCE_PAYMENTS", creditKobo: plan.creditKobo, partyType: "STUDENT", partyId: plan.creditStudentId as string });

            const posted = await d.postingService.post({
                entryDate: paidOn, description: `Payment ${receiptNumber}${p.payerName ? `: ${p.payerName}` : ""}`,
                sourceType: "PAYMENT", sourceId: p.id, purpose: "CONFIRM", lines, branchId: p.branchId, actorUserId: ctx.actorUserId,
            });

            // 4. allocations, the payment itself, the receipt
            const rows: NewAllocation[] = plan.invoices.map(a => ({ paymentId: p.id, invoiceId: a.invoiceId, studentId: a.studentId, amountKobo: a.amountKobo, createdById: ctx.actorUserId }));
            if (plan.creditKobo > 0n) rows.push({ paymentId: p.id, invoiceId: null, studentId: plan.creditStudentId as string, amountKobo: plan.creditKobo, createdById: ctx.actorUserId });
            await d.paymentRepository.addAllocations(rows);

            const ok = await d.paymentRepository.markConfirmed(p.id, p.version, {
                confirmedById: ctx.actorUserId, confirmedAt: this.now(), journalId: posted.journal.id, unallocatedKobo: plan.creditKobo,
            });
            if (!ok) throw paymentErrors.paymentChanged();

            const names = new Map((await d.paymentContextRepository.students([...new Set([...plan.invoices.map(a => a.studentId), ...(plan.creditStudentId ? [plan.creditStudentId] : [])])])).map(s => [s.id, s.name]));
            const snapshot: ReceiptSnapshot = {
                receiptNumber, issuedAt: this.now().toISOString(), paidOn,
                school: await d.paymentContextRepository.schoolHeader(ctx.schoolId),
                payer: { type: p.payerType, name: p.payerName, phone: p.payerPhone }, method: p.method, reference: p.reference, amountKobo: p.amountKobo.toString(),
                lines: plan.invoices.map(a => ({
                    invoiceNumber: before.get(a.invoiceId)!.invoiceNumber, studentId: a.studentId, studentName: names.get(a.studentId) ?? null,
                    amountKobo: a.amountKobo.toString(), balanceAfterKobo: (before.get(a.invoiceId)!.balanceKobo - a.amountKobo).toString(),
                })),
                credit: plan.creditKobo > 0n ? { studentId: plan.creditStudentId as string, studentName: names.get(plan.creditStudentId as string) ?? null, amountKobo: plan.creditKobo.toString() } : null,
            };
            await d.paymentRepository.createReceipt({ receiptNumber, paymentId: p.id, issuedAt: this.now(), snapshot });

            return (await d.paymentRepository.findById(p.id)) as PaymentEntity;
        });
    }
}
