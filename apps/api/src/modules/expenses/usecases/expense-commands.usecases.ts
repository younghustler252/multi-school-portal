import { IExpenseRepository } from "../repositories/expense.repository";
import { IVendorRepository } from "../repositories/vendor.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { ExpenseMapper } from "../mappers/expense.mapper";
import { ExpenseApprovalService, resolveMoneyAccount } from "../services/expense-approval.service";
import { hitOut } from "../services/budget-check.service";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { AuditService } from "../../audit/services/audit.service";
import { expenseErrors } from "../domain/expense.errors";
import { expenseNumber, needsApproval } from "../domain/expense.policy";
import { FinanceSettingsReader, approvalsRequired, settingsOf } from "../../finance-settings/domain/finance-settings";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import {
    CreateExpenseDtoType, UpdateExpenseDtoType, SubmitExpenseDtoType, ApproveExpenseDtoType, RejectExpenseDtoType, VoidExpenseDtoType,
} from "../dtos/expense.dto";
import { ExpenseOptions, defaultTransaction, loadExpense, prepareExpense } from "./expense-shared";

interface Dependencies {
    expenseRepository: IExpenseRepository; vendorRepository: IVendorRepository; ledgerAccountRepository: ILedgerAccountRepository;
    postingService: PostingService; numberSequenceService: NumberSequenceService; expenseApprovalService: ExpenseApprovalService;
    expenseMapper: ExpenseMapper; auditService: AuditService;
    financeSettingsService?: FinanceSettingsReader;      // the school's approval rules; absent in hand-built tests (defaults apply)
}

const withWarnings = (resp: object, warnings: Parameters<typeof hitOut>[0][]) => ({ ...resp, budgetWarnings: warnings.map(hitOut) });

/* A draft expense: nothing is posted and nothing is numbered until it is submitted. */
export class CreateExpenseUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(schoolId: string, actorUserId: string, dto: CreateExpenseDtoType) {
        const p = await prepareExpense(this.d, dto, this.now());
        const created = await this.d.expenseRepository.createDraft({ ...p.data, requestedById: actorUserId }, p.lines);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.created", entity: "Expense", entityId: created.id,
            newValue: { kind: created.kind, totalKobo: p.totalKobo.toString(), description: created.description },
        });
        return this.d.expenseMapper.toResponse(created);
    }
}

/* Edit a draft, or a rejected expense (which becomes a draft again). The version stops two people overwriting each other. */
export class UpdateExpenseUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateExpenseDtoType) {
        const before = await loadExpense(this.d.expenseRepository, id);
        if (before.status !== "DRAFT" && before.status !== "REJECTED") throw expenseErrors.notEditable(before.status);
        if (before.version !== dto.version) throw expenseErrors.expenseChanged();

        const { version: _version, ...body } = dto;
        const p = await prepareExpense(this.d, { kind: before.kind, ...body }, this.now());
        const ok = await this.transaction(() => this.d.expenseRepository.updateEditable(id, dto.version, {
            ...p.data, status: "DRAFT", rejectionReason: null, rejectedById: null, rejectedAt: null,
        }, p.lines));
        if (!ok) throw expenseErrors.expenseChanged();

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.updated", entity: "Expense", entityId: id,
            oldValue: { totalKobo: before.totalKobo.toString(), description: before.description, status: before.status },
            newValue: { totalKobo: p.totalKobo.toString(), description: dto.description, status: "DRAFT" },
        });
        return this.d.expenseMapper.toResponse(await loadExpense(this.d.expenseRepository, id));
    }
}

export class DeleteExpenseUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const e = await loadExpense(this.d.expenseRepository, id);
        if (e.status !== "DRAFT" && e.status !== "REJECTED") throw expenseErrors.notEditable(e.status);
        if (!(await this.d.expenseRepository.deleteEditable(id))) throw expenseErrors.expenseChanged();
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.deleted", entity: "Expense", entityId: id,
            oldValue: { description: e.description, totalKobo: e.totalKobo.toString(), status: e.status },
        });
        return { deleted: true };
    }
}

/*
| SUBMIT. Gives the expense its number and sends it for approval. An expense under the approval threshold (or with approval switched off)
| approves itself at once, inside the same transaction, and a DIRECT one is paid at once.
*/
export class SubmitExpenseUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: SubmitExpenseDtoType = {}) {
        const d = this.d;
        const e = await loadExpense(d.expenseRepository, id);
        if (e.status !== "DRAFT") throw expenseErrors.notSubmittable(e.status);

        let payFrom: string | null = null;
        if (e.kind === "DIRECT") {
            payFrom = dto.payFromAccountId ?? e.payFromAccountId;
            if (!payFrom) throw expenseErrors.payAccountRequired();
            await resolveMoneyAccount(d.ledgerAccountRepository, payFrom);
        }

        const settings = await settingsOf(d);
        const approvalNeeded = needsApproval(e.totalKobo, { required: settings.expenseApprovalRequired, thresholdKobo: settings.expenseApprovalThresholdKobo }) || approvalsRequired(e.totalKobo, settings) === 2;

        const warnings = await this.transaction(async () => {
            const year = todayInFinanceZone(this.now()).slice(0, 4);
            const number = expenseNumber(year, await d.numberSequenceService.next("expense", year));
            const ok = await d.expenseRepository.transition(id, ["DRAFT"], e.version, {
                status: "PENDING_APPROVAL", expenseNumber: number, submittedAt: this.now(), payFromAccountId: payFrom, rejectionReason: null,
            });
            if (!ok) throw expenseErrors.expenseChanged();
            if (approvalNeeded) return [];
            const fresh = await loadExpense(d.expenseRepository, id);
            return (await d.expenseApprovalService.approve(fresh, { schoolId, actorUserId, auto: true, payFromAccountId: payFrom ?? undefined, paidOn: dto.paidOn })).warnings;
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.submitted", entity: "Expense", entityId: id,
            newValue: { totalKobo: e.totalKobo.toString(), needsApproval: approvalNeeded },
        });
        return withWarnings(d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, id)), warnings);
    }
}

/*
| APPROVE: never the person who asked, unless the school allows self approval (finance.allow_self_approval).
| At or above the school's second approval amount, TWO different people must approve: the first approval only records who it was (the expense
| stays pending); the second one posts to the books (see ExpenseApprovalService). A rejection by anyone clears the first approval.
*/
export class ApproveExpenseUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: ApproveExpenseDtoType) {
        const d = this.d;
        const e = await loadExpense(d.expenseRepository, id);
        if (e.status !== "PENDING_APPROVAL") throw expenseErrors.notPending(e.status);
        const settings = await settingsOf(d);
        if (e.requestedById === actorUserId && !settings.allowSelfApproval) throw expenseErrors.selfApproval();

        const steps = approvalsRequired(e.totalKobo, settings);
        if (steps === 2) {
            if (!e.firstApprovedById) {
                const ok = await d.expenseRepository.transition(id, ["PENDING_APPROVAL"], e.version, { firstApprovedById: actorUserId, firstApprovedAt: this.now() });
                if (!ok) throw expenseErrors.expenseChanged();
                await d.auditService.log({
                    userId: actorUserId, schoolId, action: "expenses.first_approved", entity: "Expense", entityId: id,
                    oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "PENDING_APPROVAL", approvalsReceived: 1, approvalsRequired: 2, note: dto.note ?? null },
                });
                return { ...d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, id)), approvalsRequired: 2, approvalsReceived: 1 };
            }
            if (e.firstApprovedById === actorUserId) throw expenseErrors.secondApproverMustDiffer();
        }

        const { warnings } = await this.transaction(() => d.expenseApprovalService.approve(e, {
            schoolId, actorUserId, auto: false, note: dto.note, payFromAccountId: dto.payFromAccountId, paidOn: dto.paidOn,
        }));
        return { ...withWarnings(d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, id)), warnings), approvalsRequired: steps, approvalsReceived: steps };
    }
}

export class RejectExpenseUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(id: string, schoolId: string, actorUserId: string, dto: RejectExpenseDtoType) {
        const d = this.d;
        const e = await loadExpense(d.expenseRepository, id);
        if (e.status !== "PENDING_APPROVAL") throw expenseErrors.notPending(e.status);
        if (e.requestedById === actorUserId && !(await settingsOf(d)).allowSelfApproval) throw expenseErrors.selfApproval();
        if (!dto.reason.trim()) throw expenseErrors.rejectionReasonRequired();

        const ok = await d.expenseRepository.transition(id, ["PENDING_APPROVAL"], e.version, {
            status: "REJECTED", rejectedById: actorUserId, rejectedAt: this.now(), rejectionReason: dto.reason, firstApprovedById: null, firstApprovedAt: null,
        });
        if (!ok) throw expenseErrors.expenseChanged();
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.rejected", entity: "Expense", entityId: id,
            oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "REJECTED", reason: dto.reason },
        });
        return d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, id));
    }
}

/*
| VOID an approved, part-paid or paid expense. In one transaction: every payment still standing is reversed, then the bill's accrual
| (so the supplier is owed nothing), and the expense becomes VOID. Nothing is erased: the journals and their reversals stay in the books.
*/
export class VoidExpenseUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: VoidExpenseDtoType) {
        const d = this.d;
        const e = await loadExpense(d.expenseRepository, id);
        if (e.status !== "APPROVED" && e.status !== "PARTIALLY_PAID" && e.status !== "PAID") throw expenseErrors.notVoidable(e.status);
        const reason = dto.reason.trim();

        await this.transaction(async () => {
            for (const p of e.payments.filter(x => x.reversedAt === null)) {
                await d.postingService.reverse(p.journalId, { reason, entryDate: dto.entryDate, actorUserId });
                const marked = await d.expenseRepository.markPaymentReversed(p.id, { reversedAt: this.now(), reversedById: actorUserId, reverseReason: reason });
                if (!marked) throw expenseErrors.paymentAlreadyReversed();
            }
            if (e.journalId) await d.postingService.reverse(e.journalId, { reason, entryDate: dto.entryDate, actorUserId });
            const ok = await d.expenseRepository.transition(id, ["APPROVED", "PARTIALLY_PAID", "PAID"], e.version, {
                status: "VOID", paidKobo: 0n, voidReason: reason, voidedById: actorUserId, voidedAt: this.now(),
            });
            if (!ok) throw expenseErrors.expenseChanged();
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "expenses.voided", entity: "Expense", entityId: id,
            oldValue: { status: e.status, paidKobo: e.paidKobo.toString() }, newValue: { status: "VOID", reason },
        });
        return d.expenseMapper.toResponse(await loadExpense(d.expenseRepository, id));
    }
}

