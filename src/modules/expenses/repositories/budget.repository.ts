import { BudgetEntity, BudgetStatus } from "../domain/expense.entity";
import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";

export interface NewBudgetLine { ledgerAccountId: string; termId: string | null; plannedKobo: bigint; note: string | null }

/** A budget line that is in force on a day, with the days it covers (the term's, or the whole budget's). */
export interface ActiveLimitRow {
    ledgerAccountId: string; accountName: string; budgetId: string; budgetName: string; termId: string | null; plannedKobo: bigint;
    from: string; to: string;
}

export interface IBudgetRepository {
    findById(id: string): Promise<BudgetEntity | null>;
    list(status: BudgetStatus | undefined, page?: number, limit?: number): Promise<PaginatedResult<BudgetEntity>>;
    create(data: Record<string, any>, lines: NewBudgetLine[]): Promise<BudgetEntity>;
    update(id: string, data: Record<string, any>): Promise<BudgetEntity>;
    replaceLines(budgetId: string, lines: NewBudgetLine[]): Promise<void>;
    delete(id: string): Promise<BudgetEntity>;                                                             // soft delete
    /** Lines of ACTIVE budgets that cover this day, for these accounts. */
    activeLimits(accountIds: string[], day: string): Promise<ActiveLimitRow[]>;
    /** Money spent (debits less credits) on each account between two days, from posted journals. */
    netDebits(accountIds: string[], from: string, to: string): Promise<Map<string, bigint>>;
    /** Money earned (credits less debits) on each account between two days. */
    netCredits(accountIds: string[], from: string, to: string): Promise<Map<string, bigint>>;
    termWindow(termId: string): Promise<{ from: string; to: string } | null>;
}
