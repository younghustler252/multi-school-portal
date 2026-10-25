import { createHash, randomUUID } from "crypto";
import { IExpenseRepository } from "../repositories/expense.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { ExpenseMapper } from "../mappers/expense.mapper";
import { resolveMoneyAccount } from "../services/expense-approval.service";
import { AuditService } from "../../audit/services/audit.service";
import { expenseErrors } from "../domain/expense.errors";
import { billPaymentLines, statusAfterPayment } from "../domain/expense.policy";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { PayExpenseDtoType, ReversePaymentDtoType } from "../dtos/expense.dto";
import { ExpenseOptions, defaultTransaction, loadExpense } from "./expense-shared";

interface Dependencies {
    expenseRepository: IExpenseRepository; ledgerAccountRepository: ILedgerAccountRepository; postingService: PostingService;
    expenseMapper: ExpenseMapper; auditService: AuditService;
}

/* One click, one payment: the same request id for the same bill always gives the same payment id. */
const paymentIdFor = (expenseId: string, requestId?: string): string =>
    requestId ? `xp-${createHash("sha256").update(`${expenseId}:${requestId}`).digest("hex").slice(0, 32)}` : randomUUID();

/*
| PAY A BILL, fully or in parts: Dr Accounts payable (party: the supplier), Cr the money account it leaves from. Never more than the bill owes.
| Cash goes from cash on hand and everything else from the main bank when no account is chosen. Petty cash is chosen like any other money account.
*/
export class PayExpenseUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: PayExpenseDtoType) {
        const d = this.d;
        const first = await loadExpense(d.expenseRepository, id);
        if (first.kind === "DIRECT") throw expenseErrors.directNotPayable();

        const paymentId = paymentIdFor(id, dto.requestId);
        if (first.payments.some(p => p.id === paymentId)) return d.expenseMapper.toResponse(first);          // the same click again

        if (first.status !== "APPROVED" && first.status !== "PARTIALLY_PAID") throw expenseErrors.notPayable(first.status);

        const today = todayInFinanceZone(this.now());
        const paidOn = dto.paidOn ?? today;
        parseDay(paidOn);
        if (paidOn > today) throw expenseErrors.paymentDateFuture(paidOn, today);
        if (paidOn < dayString(first.expenseDate)) throw expenseErrors.paymentBeforeExpense();

        const account = await this.accountFor(dto);

        await this.transaction(async () => {
            const e = await loadExpense(d.expenseRepository, id);                                           // fresh, inside the transaction
            if (e.status !== "APPROVED" && e.status !== "PARTIALLY_PAID") throw expenseErrors.notPayable(e.status);
            const balance = e.totalKobo - e.paidKobo;
            if (dto.amountKobo > balance) throw expenseErrors.billOverpayment(balance);

            const posted = await d.postingService.post({
                entryDate: paidOn, description: `Payment of ${e.expenseNumber ?? "bill"}${e.vendorName ? `: ${e.vendorName}` : ""}`,
                sourceType: "EXPENSE_PAYMENT", sourceId: paymentId, purpose: "PAY",
                lines: billPaymentLines(e.vendorId, dto.amountKobo, account.id), termId: e.termId, branchId: e.branchId, actorUserId,
            });
            const paid = e.paidKobo + dto.amountKobo;
            if (!(await d.expenseRepository.applyPaid(id, e.version, paid, statusAfterPayment(e.totalKobo, paid)))) throw expenseErrors.expenseChanged();
            await d.expenseRepository.createPayment({
                id: paymentId, expenseId: id, amountKobo: dto.amountKobo, paidOn: parseDay(paidOn), accountId: account.id, method: dto.method,
                reference: dto.reference ?? null, paidById: actorUserId, journalId: posted.journal.id,
            });
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.paid", entity: "Expense", entityId: id,
            newValue: { paymentId, amountKobo: dto.amountKobo.toString(), paidOn, accountId: account.id, method: dto.method },
        });
        return d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, id));
    }

    private async accountFor(dto: PayExpenseDtoType) {
        const repo = this.d.ledgerAccountRepository;
        if (dto.accountId) return resolveMoneyAccount(repo, dto.accountId);
        const key = dto.method === "cash" ? "CASH_DEFAULT" : "BANK_DEFAULT";
        const [a] = await repo.findPostable([], [key]);
        if (!a) throw expenseErrors.payAccountInvalid("The default money account is missing. Choose an account");
        return resolveMoneyAccount(repo, a.id);
    }
}

/* REVERSE ONE PAYMENT of a bill (a bounced transfer, a wrong amount): the bill owes that money again. A direct expense is voided instead. */
export class ReverseExpensePaymentUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(expenseId: string, paymentId: string, schoolId: string, actorUserId: string, dto: ReversePaymentDtoType) {
        const d = this.d;
        const first = await loadExpense(d.expenseRepository, expenseId);
        if (first.kind === "DIRECT") throw expenseErrors.reverseDirect();
        const p = first.payments.find(x => x.id === paymentId);
        if (!p) throw expenseErrors.paymentNotFound();
        if (p.reversedAt) throw expenseErrors.paymentAlreadyReversed();
        if (first.status === "VOID") throw expenseErrors.notPayable(first.status);
        const reason = dto.reason.trim();

        await this.transaction(async () => {
            const e = await loadExpense(d.expenseRepository, expenseId);
            await d.postingService.reverse(p.journalId, { reason, entryDate: dto.entryDate, actorUserId });
            if (!(await d.expenseRepository.markPaymentReversed(paymentId, { reversedAt: this.now(), reversedById: actorUserId, reverseReason: reason }))) throw expenseErrors.paymentAlreadyReversed();
            const paid = e.paidKobo - p.amountKobo;
            if (!(await d.expenseRepository.applyPaid(expenseId, e.version, paid, statusAfterPayment(e.totalKobo, paid)))) throw expenseErrors.expenseChanged();
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.payment_reversed", entity: "Expense", entityId: expenseId,
            newValue: { paymentId, amountKobo: p.amountKobo.toString(), reason },
        });
        return d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, expenseId));
    }
}
