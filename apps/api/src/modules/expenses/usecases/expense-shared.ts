import { IExpenseRepository, NewExpenseLine } from "../repositories/expense.repository";
import { IVendorRepository } from "../repositories/vendor.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { ExpenseEntity, ExpenseKind } from "../domain/expense.entity";
import { expenseErrors } from "../domain/expense.errors";
import { checkExpenseAccounts, totalOf, vatOn } from "../domain/expense.policy";
import { FinanceSettingsReader, settingsOf } from "../../finance-settings/domain/finance-settings";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { resolveMoneyAccount } from "../services/expense-approval.service";

export interface ExpenseOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

export interface ExpenseInput {
    kind: ExpenseKind; vendorId?: string; reference?: string; description: string; expenseDate: string; dueDate?: string;
    payFromAccountId?: string; termId?: string; branchId?: string;
    lines: { ledgerAccountId: string; description?: string; amountKobo: bigint; vatKobo?: bigint; vatable?: boolean }[];
}

interface PrepareDeps { expenseRepository: IExpenseRepository; vendorRepository: IVendorRepository; ledgerAccountRepository: ILedgerAccountRepository; financeSettingsService?: FinanceSettingsReader }

export async function loadExpense(repo: IExpenseRepository, id: string): Promise<ExpenseEntity> {
    const e = await repo.findById(id);
    if (!e) throw expenseErrors.expenseNotFound();
    return e;
}

/* Checks everything about a new or edited expense that does not depend on who is asking, and turns it into rows. */
export async function prepareExpense(d: PrepareDeps, input: ExpenseInput, now: Date): Promise<{ data: Record<string, unknown>; lines: NewExpenseLine[]; totalKobo: bigint }> {
    const today = todayInFinanceZone(now);
    const expenseDate = parseDay(input.expenseDate);
    if (input.expenseDate > today) throw expenseErrors.expenseDateFuture(input.expenseDate, today);
    if (input.dueDate) { parseDay(input.dueDate); if (input.dueDate < input.expenseDate) throw expenseErrors.dueBeforeExpense(); }
    if (input.lines.length === 0) throw expenseErrors.expenseEmpty();

    if (input.kind === "BILL" && !input.vendorId) throw expenseErrors.vendorRequired();
    if (input.vendorId) {
        const v = await d.vendorRepository.findById(input.vendorId);
        if (!v) throw expenseErrors.refNotFound("The vendor");
        if (!v.isActive) throw expenseErrors.vendorInactive(v.name);
    }

    const accounts = await d.ledgerAccountRepository.findByIds(input.lines.map(l => l.ledgerAccountId));
    checkExpenseAccounts(input.lines.map(l => l.ledgerAccountId), accounts);

    if (input.kind === "DIRECT" && input.payFromAccountId) await resolveMoneyAccount(d.ledgerAccountRepository, input.payFromAccountId);
    if (input.termId && !(await d.expenseRepository.termExists(input.termId))) throw expenseErrors.refNotFound("The term");
    if (input.branchId && !(await d.expenseRepository.branchExists(input.branchId))) throw expenseErrors.refNotFound("The branch");

    // VAT: only when the school turned it on. A line carries the exact VAT from the invoice, or is marked vatable and gets the school's rate.
    const asksForVat = input.lines.some(l => (l.vatKobo ?? 0n) > 0n || l.vatable);
    const settings = await settingsOf(d);
    if (asksForVat && !settings.vatEnabled) throw expenseErrors.vatNotEnabled();
    const lines: NewExpenseLine[] = input.lines.map((l, i) => ({
        ledgerAccountId: l.ledgerAccountId, description: l.description ?? input.description, amountKobo: l.amountKobo, sortOrder: i,
        vatKobo: l.vatKobo !== undefined ? l.vatKobo : l.vatable ? vatOn(l.amountKobo, settings.vatRateBps) : 0n,
    }));
    const totalKobo = totalOf(lines);
    return {
        totalKobo, lines,
        data: {
            kind: input.kind, vendorId: input.vendorId ?? null, reference: input.reference ?? null, description: input.description, expenseDate,
            dueDate: input.dueDate ? parseDay(input.dueDate) : null, totalKobo,
            payFromAccountId: input.kind === "DIRECT" ? input.payFromAccountId ?? null : null, termId: input.termId ?? null, branchId: input.branchId ?? null,
        },
    };
}
