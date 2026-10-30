import { IFeeAdjustmentRepository } from "../repositories/fee-adjustment.repository";
import { CreditService } from "../../payments/services/credit.service";
import { IFeeInvoiceRepository } from "../repositories/fee-invoice.repository";
import { FeeInvoiceMapper } from "../mappers/fee-invoice.mapper";
import { PostingService } from "../../ledger/services/posting.service";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { AuditService } from "../../audit/services/audit.service";
import { AppError } from "../../../shared/errors/domain.errors";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { feeErrors } from "../domain/fee.errors";
import { issueLines, invoiceNumber, statusAtIssue, AUTO_APPLY_CREDIT } from "../domain/invoice.policy";
import { IssueInvoiceDtoType, BulkIssueDtoType, VoidInvoiceDtoType } from "../dtos/invoice.dto";

interface Dependencies {
    feeInvoiceRepository: IFeeInvoiceRepository; feeInvoiceMapper: FeeInvoiceMapper; postingService: PostingService;
    numberSequenceService: NumberSequenceService; auditService: AuditService;
    feeAdjustmentRepository?: IFeeAdjustmentRepository;                       // void checks it for approved adjustments
    creditService?: CreditService;                                            // issue uses the student's credit on the new invoice
}

// Replaced in tests only (container injection passes just the first argument)
export interface InvoiceOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

// Loaded on first use so that importing this file never needs a database connection
const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/*
| ISSUE AN INVOICE (brief rule 1). In ONE transaction: take the next invoice number, post the journal (receivable, discounts
| allowed, income), and mark the invoice issued. If any step fails nothing is kept, not even the number, so numbers have no gaps.
| The version check stops two people issuing the same draft at once. A fully discounted invoice is issued as paid.
*/
export class IssueInvoiceUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: InvoiceOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: IssueInvoiceDtoType = {}) {
        const repo = this.d.feeInvoiceRepository;
        const inv = await repo.findById(id);
        if (!inv) throw feeErrors.invoiceNotFound();
        if (inv.status !== "draft") throw feeErrors.invoiceNotDraft(inv.invoiceNumber);
        if (inv.subtotalKobo <= 0n) throw feeErrors.invoiceEmpty();

        const issueDate = dto.issueDate ?? todayInFinanceZone(this.now());
        parseDay(issueDate);                                                          // rejects a date that does not exist

        const done = await this.transaction(async () => {
            const year = issueDate.slice(0, 4);
            const number = invoiceNumber(year, await this.d.numberSequenceService.next("invoice", year));
            const posted = await this.d.postingService.post({
                entryDate: issueDate, description: `Invoice ${number}${inv.studentName ? `: ${inv.studentName}` : ""}`,
                sourceType: "FEE_INVOICE", sourceId: inv.id, purpose: "ISSUE", lines: issueLines(inv),
                termId: inv.termId, sessionId: inv.sessionId, branchId: inv.branchId, actorUserId,
            });
            const ok = await repo.markIssued(inv.id, inv.version, {
                invoiceNumber: number, status: statusAtIssue(inv.balanceKobo), issueDate: parseDay(issueDate),
                journalId: posted.journal.id, updatedById: actorUserId,
            });
            if (!ok) throw feeErrors.invoiceChanged();                                // undoes the number and the journal

            // credit the student already holds (paid in advance) goes onto the new invoice at once
            let creditAppliedKobo = 0n;
            if (AUTO_APPLY_CREDIT && this.d.creditService && inv.balanceKobo > 0n) {
                const [fresh] = await repo.findManyByIds([inv.id]);
                creditAppliedKobo = await this.d.creditService.applyToInvoice(fresh, undefined, actorUserId);
            }
            return { number, journalNumber: posted.journal.number, creditAppliedKobo };
        });

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.invoice.issued", entity: "FeeInvoice", entityId: id,
            newValue: { invoiceNumber: done.number, journalNumber: done.journalNumber, issueDate, totalKobo: inv.totalKobo.toString(), discountKobo: inv.discountKobo.toString(), creditAppliedKobo: done.creditAppliedKobo.toString() },
        });
        return this.d.feeInvoiceMapper.toResponse((await repo.findById(id))!);
    }
}

/* ISSUE MANY: the drafts named, or every draft for a term (and class, campus). Each is its own transaction, so one failure
   (a closed month, say) never blocks the rest. The answer lists what was issued and what was not, with the reason. */
export class BulkIssueInvoicesUseCase {
    constructor(private readonly d: Dependencies & { issueInvoiceUseCase: IssueInvoiceUseCase }) {}

    async execute(schoolId: string, actorUserId: string, dto: BulkIssueDtoType) {
        const ids = dto.invoiceIds ?? await this.d.feeInvoiceRepository.draftIds({ termId: dto.termId, classId: dto.classId, branchId: dto.branchId });
        const issued: { id: string; invoiceNumber: string | null }[] = [];
        const failed: { id: string; code: string; message: string }[] = [];

        for (const id of ids) {
            try {
                const r = await this.d.issueInvoiceUseCase.execute(id, schoolId, actorUserId, { issueDate: dto.issueDate });
                issued.push({ id, invoiceNumber: r.invoiceNumber });
            } catch (e) {
                if (!(e instanceof AppError)) throw e;                                // a bug should be seen, not listed
                failed.push({ id, code: e.code ?? "ERROR", message: e.message });
            }
        }
        return { issued, failed };
    }
}

/*
| VOID AN ISSUED INVOICE: reverse its journal and mark it void. Only while nothing has been paid or adjusted.
| After that, the honest path is a credit note (and a refund if money must go back).
*/
export class VoidInvoiceUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: InvoiceOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: VoidInvoiceDtoType) {
        const repo = this.d.feeInvoiceRepository;
        const inv = await repo.findById(id);
        if (!inv) throw feeErrors.invoiceNotFound();
        if (inv.status === "void") throw feeErrors.invoiceAlreadyVoid();
        if (inv.status === "draft" || !inv.journalId) throw feeErrors.invoiceNotIssued();
        if (inv.paidKobo > 0n || (await repo.countPayments(id)) > 0) throw feeErrors.invoiceHasPayments();
        if (inv.adjustmentsKobo !== 0n || ((await this.d.feeAdjustmentRepository?.countApprovedForInvoice(id)) ?? 0) > 0) throw feeErrors.invoiceHasAdjustments();

        await this.transaction(async () => {
            await this.d.postingService.reverse(inv.journalId as string, { reason: `Invoice ${inv.invoiceNumber} voided: ${dto.reason}`, actorUserId });
            const ok = await repo.markVoid(inv.id, inv.version, {
                status: "void", voidedAt: this.now(), voidedById: actorUserId, voidReason: dto.reason, updatedById: actorUserId,
            });
            if (!ok) throw feeErrors.invoiceChanged();
        });

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.invoice.voided", entity: "FeeInvoice", entityId: id,
            oldValue: { status: inv.status, invoiceNumber: inv.invoiceNumber, totalKobo: inv.totalKobo.toString() }, newValue: { status: "void", reason: dto.reason },
        });
        return this.d.feeInvoiceMapper.toResponse((await repo.findById(id))!);
    }
}
