import { IPaymentRepository } from "../repositories/payment.repository";
import { IRefundRepository } from "../repositories/refund.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { RefundMapper } from "../mappers/refund.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { paymentErrors } from "../domain/payment.errors";
import { FinanceSettingsReader, approvalsRequired, settingsOf } from "../../finance-settings/domain/finance-settings";
import { ApproveRefundDtoType, ListRefundsQueryType, PayRefundDtoType, RejectRefundDtoType, RequestRefundDtoType } from "../dtos/payment.dto";

interface Dependencies {
    paymentRepository: IPaymentRepository; refundRepository: IRefundRepository; paymentContextRepository: IPaymentContextRepository;
    ledgerAccountRepository: ILedgerAccountRepository; postingService: PostingService; refundMapper: RefundMapper; auditService: AuditService;
    financeSettingsService?: FinanceSettingsReader;      // finance.allow_self_approval; absent in hand-built tests (default: not allowed)
}

export interface RefundOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/* The credit a student holds from one payment, not counting refunds already asked for or approved. */
async function creditOnPayment(d: Dependencies, paymentId: string, studentId: string): Promise<{ held: bigint; available: bigint }> {
    const row = (await d.paymentRepository.creditRows(studentId)).find(r => r.paymentId === paymentId);
    const held = row?.amountKobo ?? 0n;
    const open = await d.refundRepository.openAmountFor(paymentId, studentId);
    return { held, available: held > open ? held - open : 0n };
}

export class ListRefundsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListRefundsQueryType) {
        const r = await this.d.refundRepository.list({ status: q.status, paymentId: q.paymentId, studentId: q.studentId }, q.page, q.limit);
        return { data: r.data.map(x => this.d.refundMapper.toResponse(x)), meta: r.meta };
    }
}

export class GetRefundUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) {
        const r = await this.d.refundRepository.findById(id);
        if (!r) throw paymentErrors.refundNotFound();
        return this.d.refundMapper.toResponse(r);
    }
}

/*
| REFUND (brief rule 8). Only credit can be refunded: money a student paid beyond what they owe. To get money back for fees that were
| charged, cancel the charge with a credit note first (that turns the overpaid part into credit), then refund the credit.
| Three steps, two people: ask, approve (not the same person), then pay out (the money leaves a money account).
*/
export class RequestRefundUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: RequestRefundDtoType) {
        const p = await this.d.paymentRepository.findById(dto.paymentId);
        if (!p) throw paymentErrors.paymentNotFound();
        if (p.status !== "CONFIRMED") throw paymentErrors.notConfirmed(p.status);
        if ((await this.d.paymentContextRepository.students([dto.studentId])).length === 0) throw paymentErrors.studentNotFound(dto.studentId);

        const { available } = await creditOnPayment(this.d, dto.paymentId, dto.studentId);
        if (dto.amountKobo > available) throw paymentErrors.noCredit(available);

        const created = await this.d.refundRepository.create({
            paymentId: dto.paymentId, studentId: dto.studentId, amountKobo: dto.amountKobo, reason: dto.reason, requestedById: actorUserId,
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.refund.requested", entity: "Refund", entityId: created.id,
            newValue: { paymentId: dto.paymentId, studentId: dto.studentId, amountKobo: dto.amountKobo.toString(), reason: dto.reason },
        });
        return this.d.refundMapper.toResponse(created);
    }
}

/* APPROVE or REJECT. Never the person who asked (until the self-approval setting exists). Nothing is posted yet. */
export class DecideRefundUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: RefundOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async approve(id: string, schoolId: string, actorUserId: string, dto: ApproveRefundDtoType) { return this.decide(id, schoolId, actorUserId, "APPROVED", dto.note); }
    async reject(id: string, schoolId: string, actorUserId: string, dto: RejectRefundDtoType) { return this.decide(id, schoolId, actorUserId, "REJECTED", dto.note); }

    private async decide(id: string, schoolId: string, actorUserId: string, status: "APPROVED" | "REJECTED", note?: string) {
        const r = await this.d.refundRepository.findById(id);
        if (!r) throw paymentErrors.refundNotFound();
        if (r.status !== "REQUESTED") throw paymentErrors.refundNotRequested(r.status);
        const settings = await settingsOf(this.d);
        if (r.requestedById === actorUserId && !settings.allowSelfApproval) throw paymentErrors.selfApproval();
        // At or above the second-approval amount, the first approval is only recorded; a different person's approval completes it. A rejection by anyone is final.
        if (status === "APPROVED" && approvalsRequired(r.amountKobo, settings) === 2) {
            if (!r.firstApprovedById) {
                if (!(await this.d.refundRepository.recordFirstApproval(id, actorUserId, this.now()))) throw paymentErrors.refundChanged();
                await this.d.auditService.log({
                    userId: actorUserId, schoolId, action: "payments.refund.first_approved", entity: "Refund", entityId: id,
                    oldValue: { status: "REQUESTED" }, newValue: { status: "REQUESTED", approvalsReceived: 1, approvalsRequired: 2, note: note ?? null },
                });
                return { ...this.d.refundMapper.toResponse((await this.d.refundRepository.findById(id))!), approvalsRequired: 2, approvalsReceived: 1 };
            }
            if (r.firstApprovedById === actorUserId) throw paymentErrors.secondApproverMustDiffer();
        }
        if (!(await this.d.refundRepository.markDecided(id, { decidedById: actorUserId, decidedAt: this.now(), decisionNote: note ?? null }, status))) throw paymentErrors.refundChanged();

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: status === "APPROVED" ? "payments.refund.approved" : "payments.refund.rejected", entity: "Refund", entityId: id,
            oldValue: { status: r.status }, newValue: { status, note: note ?? null },
        });
        return this.d.refundMapper.toResponse((await this.d.refundRepository.findById(id))!);
    }
}

/* PAY OUT an approved refund: Dr advance payments, Cr the money account it leaves from; the student's credit and the payment's
   unallocated amount go down by the same amount. All in one transaction. */
export class PayRefundUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: RefundOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: PayRefundDtoType) {
        const d = this.d;
        const r = await d.refundRepository.findById(id);
        if (!r) throw paymentErrors.refundNotFound();
        if (r.status !== "APPROVED") throw paymentErrors.refundNotApproved(r.status);
        const p = await d.paymentRepository.findById(r.paymentId);
        if (!p) throw paymentErrors.paymentNotFound();
        if (p.status !== "CONFIRMED") throw paymentErrors.notConfirmed(p.status);
        const studentId = r.studentId as string;

        const today = todayInFinanceZone(this.now());
        const paidOn = dto.paidOn ?? today;
        parseDay(paidOn);
        if (paidOn > today) throw paymentErrors.futureDate();
        const account = await this.payoutAccount(dto.payoutAccountId, p.accountId);

        await this.transaction(async () => {
            const row = (await d.paymentRepository.creditRows(studentId)).find(x => x.paymentId === p.id);
            if (!row || row.amountKobo < r.amountKobo) throw paymentErrors.noCredit(row?.amountKobo ?? 0n);      // the credit was used since it was approved

            const posted = await d.postingService.post({
                entryDate: paidOn, description: `Refund${r.receiptNumber ? ` of ${r.receiptNumber}` : ""}${r.studentName ? `: ${r.studentName}` : ""}`,
                sourceType: "REFUND", sourceId: r.id, purpose: "PAY",
                lines: [
                    { systemKey: "ADVANCE_PAYMENTS", debitKobo: r.amountKobo, partyType: "STUDENT", partyId: studentId },
                    { accountId: account.id, creditKobo: r.amountKobo },
                ],
                branchId: p.branchId, actorUserId,
            });
            await d.paymentRepository.setAllocationAmount(row.allocationId, row.amountKobo - r.amountKobo);
            await d.paymentRepository.adjustUnallocated(p.id, -r.amountKobo);
            const ok = await d.refundRepository.markPaid(r.id, { paidAt: parseDay(paidOn), journalId: posted.journal.id, payoutAccountId: account.id });
            if (!ok) throw paymentErrors.refundChanged();
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.refund.paid", entity: "Refund", entityId: id,
            newValue: { amountKobo: r.amountKobo.toString(), paidOn, payoutAccountId: account.id },
        });
        return d.refundMapper.toResponse((await d.refundRepository.findById(id))!);
    }

    // The account chosen, else the one the payment landed in (a bank account when it landed in the online clearing account)
    private async payoutAccount(chosen: string | undefined, paymentAccountId: string) {
        const repo = this.d.ledgerAccountRepository;
        const a = chosen ? await repo.findById(chosen) : await repo.findById(paymentAccountId);
        const fallback = !chosen && a?.subtype === "ONLINE_CLEARING";
        const use = fallback ? (await repo.findPostable([], ["BANK_DEFAULT"]))[0] : a;
        if (!use || !use.isActive) throw paymentErrors.accountInvalid("The money account does not exist or is not active");
        if (!use.isMoneyAccount) throw paymentErrors.accountInvalid("A refund must be paid from a cash, bank or other money account");
        if (use.subtype === "ONLINE_CLEARING") throw paymentErrors.accountInvalid("A refund cannot be paid from the online payments clearing account");
        return use;
    }
}
