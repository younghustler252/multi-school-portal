import { randomUUID } from "crypto";
import { IExpenseRepository } from "../repositories/expense.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { BudgetCheckService } from "./budget-check.service";
import { AuditService } from "../../audit/services/audit.service";
import { ExpenseEntity } from "../domain/expense.entity";
import { expenseErrors } from "../domain/expense.errors";
import { BudgetHit, accrualLines, directLines } from "../domain/expense.policy";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";

interface Dependencies {
    expenseRepository: IExpenseRepository; ledgerAccountRepository: ILedgerAccountRepository; postingService: PostingService;
    budgetCheckService: BudgetCheckService; auditService: AuditService;
}

export interface ApprovalOptions { now?: () => Date }

export interface ApproveInput {
    schoolId: string; actorUserId: string; auto: boolean; note?: string;
    payFromAccountId?: string; paidOn?: string;
}

/* A money account an expense can be paid from: active, a real cash, bank or petty cash account (never the online clearing account). */
export async function resolveMoneyAccount(repo: ILedgerAccountRepository, accountId: string) {
    const a = await repo.findById(accountId);
    if (!a || !a.isActive) throw expenseErrors.payAccountInvalid("The money account does not exist or is not active");
    if (!a.isMoneyAccount) throw expenseErrors.payAccountInvalid("Pay from a cash, bank or petty cash account");
    if (a.subtype === "ONLINE_CLEARING") throw expenseErrors.payAccountInvalid("An expense cannot be paid from the online payments clearing account");
    return a;
}

/* How a payment is described when the person did not say: by the kind of account it leaves. */
export const methodForAccount = (subtype: string): string => (subtype === "BANK" ? "bank_transfer" : subtype === "CASH" || subtype === "PETTY_CASH" ? "cash" : "other");

/*
| APPROVING AN EXPENSE (the single place it happens; submit, approve and the recurring job all come here). Call it inside a transaction.
|   BILL    posts Dr each expense account, Cr Accounts payable (party: the supplier). Status APPROVED, owed until paid.
|   DIRECT  posts Dr each expense account, Cr the money account, and records the one payment. Status PAID.
| The journal and the state change are one unit: if someone else decided it first, the state change fails and the caller's transaction undoes the posting.
*/
export class ExpenseApprovalService {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ApprovalOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async approve(expense: ExpenseEntity, input: ApproveInput): Promise<{ warnings: BudgetHit[] }> {
        const d = this.d;
        const today = todayInFinanceZone(this.now());
        const expenseDay = dayString(expense.expenseDate);

        // DIRECT: where the money leaves from, and when
        let payAccount: Awaited<ReturnType<typeof resolveMoneyAccount>> | null = null;
        let paidOn = expenseDay;
        if (expense.kind === "DIRECT") {
            const accountId = input.payFromAccountId ?? expense.payFromAccountId;
            if (!accountId) throw expenseErrors.payAccountRequired();
            payAccount = await resolveMoneyAccount(d.ledgerAccountRepository, accountId);
            paidOn = input.paidOn ?? expenseDay;
            parseDay(paidOn);
            if (paidOn > today) throw expenseErrors.paymentDateFuture(paidOn, today);
            if (paidOn < expenseDay) throw expenseErrors.paymentBeforeExpense();
        }

        const warnings = await d.budgetCheckService.check(expense.lines, expenseDay);
        const decided = { approvedById: input.actorUserId, approvedAt: this.now(), autoApproved: input.auto, rejectionReason: null, rejectedById: null, rejectedAt: null };
        const common = { description: `${expense.expenseNumber ?? "Expense"}: ${expense.description}` };

        if (expense.kind === "BILL") {
            const posted = await d.postingService.post({
                entryDate: expenseDay, ...common, sourceType: "EXPENSE_BILL", sourceId: expense.id, purpose: "ACCRUE",
                lines: accrualLines(expense), termId: expense.termId, branchId: expense.branchId, actorUserId: input.actorUserId,
            });
            const ok = await d.expenseRepository.transition(expense.id, ["PENDING_APPROVAL"], expense.version, { ...decided, status: "APPROVED", journalId: posted.journal.id });
            if (!ok) throw expenseErrors.expenseChanged();
        } else {
            const paymentId = randomUUID();
            const posted = await d.postingService.post({
                entryDate: paidOn, ...common, sourceType: "EXPENSE_PAYMENT", sourceId: paymentId, purpose: "PAY",
                lines: directLines(expense, payAccount!.id), termId: expense.termId, branchId: expense.branchId, actorUserId: input.actorUserId,
            });
            const ok = await d.expenseRepository.transition(expense.id, ["PENDING_APPROVAL"], expense.version, {
                ...decided, status: "PAID", paidKobo: expense.totalKobo, payFromAccountId: payAccount!.id,
            });
            if (!ok) throw expenseErrors.expenseChanged();
            await d.expenseRepository.createPayment({
                id: paymentId, expenseId: expense.id, amountKobo: expense.totalKobo, paidOn: parseDay(paidOn), accountId: payAccount!.id,
                method: methodForAccount(payAccount!.subtype), reference: expense.reference, paidById: input.actorUserId, journalId: posted.journal.id,
            });
        }

        await d.auditService.log({
            userId: input.actorUserId, schoolId: input.schoolId, action: input.auto ? "expenses.auto_approved" : "expenses.approved", entity: "Expense", entityId: expense.id,
            oldValue: { status: "PENDING_APPROVAL" },
            newValue: { status: expense.kind === "BILL" ? "APPROVED" : "PAID", totalKobo: expense.totalKobo.toString(), note: input.note ?? null, budgetWarnings: warnings.length },
        });
        return { warnings };
    }
}

