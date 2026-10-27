import { IFeeInvoiceRepository } from "../repositories/fee-invoice.repository";
import { IFeeAdjustmentRepository } from "../repositories/fee-adjustment.repository";
import { IPaymentRepository } from "../../payments/repositories/payment.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { FeeAdjustmentMapper } from "../mappers/fee-adjustment.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { feeErrors } from "../domain/fee.errors";
import { ADJUSTMENT_LABEL, planAdjustment } from "../domain/adjustment.policy";
import { FinanceSettingsReader, settingsOf } from "../../finance-settings/domain/finance-settings";
import { ApproveAdjustmentDtoType, ListAdjustmentsQueryType, RejectAdjustmentDtoType, RequestAdjustmentDtoType } from "../dtos/adjustment.dto";
import type { FeeInvoiceEntity } from "../domain/invoice.entity";

interface Dependencies {
    feeInvoiceRepository: IFeeInvoiceRepository; feeAdjustmentRepository: IFeeAdjustmentRepository; paymentRepository: IPaymentRepository;
    postingService: PostingService; feeAdjustmentMapper: FeeAdjustmentMapper; auditService: AuditService;
    financeSettingsService?: FinanceSettingsReader;      // finance.allow_self_approval; absent in hand-built tests (default: not allowed)
}

export interface AdjustmentOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

export class ListAdjustmentsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListAdjustmentsQueryType) {
        const r = await this.d.feeAdjustmentRepository.list({ status: q.status, type: q.type, invoiceId: q.invoiceId, studentId: q.studentId }, q.page, q.limit);
        return { data: r.data.map(x => this.d.feeAdjustmentMapper.toResponse(x)), meta: r.meta };
    }
}

export class GetAdjustmentUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) {
        const a = await this.d.feeAdjustmentRepository.findById(id);
        if (!a) throw feeErrors.adjustmentNotFound();
        return this.d.feeAdjustmentMapper.toResponse(a);
    }
}

// The invoice and, for a credit note, the fee it cancels; planned the same way when asked for and when approved
async function planFor(d: Dependencies, invoiceId: string, type: RequestAdjustmentDtoType["type"], amountKobo: bigint, itemId: string | null) {
    const inv = await d.feeInvoiceRepository.findById(invoiceId);
    if (!inv) throw feeErrors.invoiceNotFound();
    if (inv.status === "draft" || inv.status === "void") throw feeErrors.adjustmentInvoiceState(inv.status);
    const item = itemId ? inv.items.find(i => i.id === itemId) ?? null : null;
    if (itemId && !item) throw feeErrors.itemNotOnInvoice();
    const creditedBefore = item ? await d.feeAdjustmentRepository.creditedOnItem(item.id) : 0n;
    return { inv, plan: planAdjustment(inv, { type, amountKobo, item, creditedBefore }) };
}

/* ASK FOR AN ADJUSTMENT. Checked now against the invoice as it is, and checked again when approved. Nothing is posted yet. */
export class RequestAdjustmentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: RequestAdjustmentDtoType) {
        await planFor(this.d, dto.invoiceId, dto.type, dto.amountKobo, dto.invoiceItemId ?? null);
        const created = await this.d.feeAdjustmentRepository.create({
            invoiceId: dto.invoiceId, type: dto.type, invoiceItemId: dto.invoiceItemId ?? null, amountKobo: dto.amountKobo, reason: dto.reason, requestedById: actorUserId,
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.adjustment.requested", entity: "InvoiceAdjustment", entityId: created.id,
            newValue: { invoiceId: dto.invoiceId, type: dto.type, amountKobo: dto.amountKobo.toString(), reason: dto.reason },
        });
        return this.d.feeAdjustmentMapper.toResponse(created);
    }
}

/*
| APPROVE or REJECT. Never the person who asked (until the self-approval setting exists). Approving, in ONE transaction:
| post the journal, change the invoice's money, and (credit note on an overpaid invoice) move the overpaid part from the invoice
| to the student's credit. A rejection touches nothing but the request.
*/
export class DecideAdjustmentUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: AdjustmentOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async reject(id: string, schoolId: string, actorUserId: string, dto: RejectAdjustmentDtoType) {
        const a = await this.load(id, actorUserId);
        if (!(await this.d.feeAdjustmentRepository.markDecided(id, { decidedById: actorUserId, decidedAt: this.now(), decisionNote: dto.note }, "REJECTED"))) throw feeErrors.adjustmentChanged();
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.adjustment.rejected", entity: "InvoiceAdjustment", entityId: id,
            oldValue: { status: a.status }, newValue: { status: "REJECTED", note: dto.note },
        });
        return this.d.feeAdjustmentMapper.toResponse((await this.d.feeAdjustmentRepository.findById(id))!);
    }

    async approve(id: string, schoolId: string, actorUserId: string, dto: ApproveAdjustmentDtoType) {
        const d = this.d;
        const a = await this.load(id, actorUserId);

        await this.transaction(async () => {
            const { inv, plan } = await planFor(d, a.invoiceId, a.type, a.amountKobo, a.invoiceItemId);

            const posted = await d.postingService.post({
                entryDate: todayInFinanceZone(this.now()), description: `${ADJUSTMENT_LABEL[a.type]} on ${inv.invoiceNumber}${inv.studentName ? `: ${inv.studentName}` : ""} (${a.reason})`,
                sourceType: "ADJUSTMENT", sourceId: a.id, purpose: "APPROVE", lines: plan.lines,
                termId: inv.termId, sessionId: inv.sessionId, branchId: inv.branchId, actorUserId,
            });
            const ok = await d.feeInvoiceRepository.updateAmounts(inv.id, inv.version, {
                adjustmentsKobo: plan.adjustmentsKobo, discountKobo: plan.discountKobo, totalKobo: plan.totalKobo,
                paidKobo: plan.paidKobo, balanceKobo: plan.balanceKobo, status: plan.status,
            });
            if (!ok) throw feeErrors.invoiceChanged();
            if (plan.extraDiscountKobo > 0n) await d.feeInvoiceRepository.addDiscountLine(inv.id, `Extra discount: ${a.reason}`.slice(0, 200), plan.extraDiscountKobo);
            if (plan.excessKobo > 0n) await this.moveExcessToCredit(inv, plan.excessKobo, actorUserId);
            const decided = await d.feeAdjustmentRepository.markDecided(a.id, { decidedById: actorUserId, decidedAt: this.now(), decisionNote: dto.note ?? null, journalId: posted.journal.id }, "APPROVED");
            if (!decided) throw feeErrors.adjustmentChanged();
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.adjustment.approved", entity: "InvoiceAdjustment", entityId: id,
            oldValue: { status: a.status }, newValue: { status: "APPROVED", type: a.type, amountKobo: a.amountKobo.toString(), invoiceId: a.invoiceId },
        });
        return d.feeAdjustmentMapper.toResponse((await d.feeAdjustmentRepository.findById(id))!);
    }

    private async load(id: string, actorUserId: string) {
        const a = await this.d.feeAdjustmentRepository.findById(id);
        if (!a) throw feeErrors.adjustmentNotFound();
        if (a.status !== "PENDING") throw feeErrors.adjustmentNotPending(a.status);
        if (a.requestedById === actorUserId && !(await settingsOf(this.d)).allowSelfApproval) throw feeErrors.adjustmentSelfApproval();
        return a;
    }

    // The money paid beyond the new total stops being "paid on the invoice" and becomes the student's credit, taken from the newest payments first
    private async moveExcessToCredit(inv: FeeInvoiceEntity, excess: bigint, actorUserId: string) {
        const pay = this.d.paymentRepository;
        let left = excess;
        for (const alloc of await pay.invoiceAllocations(inv.id)) {
            if (left <= 0n) break;
            const t = alloc.amountKobo < left ? alloc.amountKobo : left;
            await pay.setAllocationAmount(alloc.id, alloc.amountKobo - t);
            await pay.addCredit(alloc.paymentId, alloc.studentId, t, actorUserId);
            await pay.adjustUnallocated(alloc.paymentId, t);
            left -= t;
        }
        if (left > 0n) throw feeErrors.invoiceChanged();                        // the invoice's payments no longer add up: stop rather than guess
    }
}
