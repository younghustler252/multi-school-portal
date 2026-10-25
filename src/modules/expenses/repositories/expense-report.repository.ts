export interface ExpenseLineRow {
    expenseId: string; expenseNumber: string | null; expenseDate: Date; ledgerAccountId: string; accountCode: string; accountName: string;
    vendorId: string | null; vendorName: string | null; termId: string | null; amountKobo: bigint;
}

export interface OpenBillRow {
    id: string; expenseNumber: string | null; vendorId: string | null; vendorName: string | null; description: string;
    expenseDate: Date; dueDate: Date | null; totalKobo: bigint; paidKobo: bigint;
}

export interface IExpenseReportRepository {
    /** Lines of approved (so owed or paid) expenses dated in the range. Drafts, pending, rejected and void ones are not included. */
    expenseLines(from: string, to: string, filters: { vendorId?: string; termId?: string }): Promise<ExpenseLineRow[]>;
    /** Approved bills that still owe money. */
    openBills(filters: { vendorId?: string }): Promise<OpenBillRow[]>;
    termNames(ids: string[]): Promise<Map<string, string>>;
}
