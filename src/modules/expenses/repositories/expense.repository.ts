import { ExpenseEntity, ExpenseFilters, ExpenseStatus } from "../domain/expense.entity";
import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";

export interface NewExpenseLine { ledgerAccountId: string; description: string; amountKobo: bigint; vatKobo: bigint; sortOrder: number }

export interface IExpenseRepository {
    findById(id: string): Promise<ExpenseEntity | null>;                                                    // with lines and payments
    list(f: ExpenseFilters, page?: number, limit?: number): Promise<PaginatedResult<ExpenseEntity>>;       // no lines or payments
    createDraft(data: Record<string, any>, lines: NewExpenseLine[]): Promise<ExpenseEntity>;
    /** Changes a draft or rejected expense and replaces its lines, only if nobody changed it meanwhile. False = stale or no longer editable. */
    updateEditable(id: string, version: number, data: Record<string, any>, lines: NewExpenseLine[]): Promise<boolean>;
    deleteEditable(id: string): Promise<boolean>;
    /** Moves an expense from one of these states to another (data says which), only at this version. False = someone else got there first. */
    transition(id: string, from: ExpenseStatus[], version: number, data: Record<string, any>): Promise<boolean>;
    /** Sets the paid amount and status, only at this version. */
    applyPaid(id: string, version: number, paidKobo: bigint, status: ExpenseStatus): Promise<boolean>;
    createPayment(data: Record<string, any>): Promise<void>;
    markPaymentReversed(paymentId: string, data: Record<string, any>): Promise<boolean>;
    recurringExists(recurringId: string, expenseDay: string): Promise<boolean>;
    termExists(id: string): Promise<boolean>;
    branchExists(id: string): Promise<boolean>;
}
