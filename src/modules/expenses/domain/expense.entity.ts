export type ExpenseKind = "DIRECT" | "BILL";
export type ExpenseStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "REJECTED" | "VOID";
export type RecurrenceFrequency = "WEEKLY" | "MONTHLY" | "TERMLY" | "YEARLY";
export type BudgetStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export interface VendorEntity {
    id: string; name: string; contactName: string | null; phone: string | null; email: string | null; address: string | null;
    bankName: string | null; accountName: string | null; accountNumberLast4: string | null; hasAccountNumber: boolean;
    taxId: string | null; notes: string | null; isActive: boolean; createdAt: Date; updatedAt: Date;
}

export interface ExpenseLineEntity {
    id: string; ledgerAccountId: string; accountCode: string | null; accountName: string | null;
    description: string; amountKobo: bigint; vatKobo: bigint; sortOrder: number;
}

export interface ExpensePaymentEntity {
    id: string; expenseId: string; amountKobo: bigint; paidOn: Date; accountId: string; accountName: string | null; method: string;
    reference: string | null; paidById: string; journalId: string; reversedAt: Date | null; reversedById: string | null; reverseReason: string | null; createdAt: Date;
}

export interface ExpenseEntity {
    id: string; expenseNumber: string | null; kind: ExpenseKind; vendorId: string | null; vendorName: string | null; reference: string | null;
    description: string; expenseDate: Date; dueDate: Date | null; totalKobo: bigint; paidKobo: bigint; status: ExpenseStatus;
    payFromAccountId: string | null; termId: string | null; branchId: string | null; recurringExpenseId: string | null;
    requestedById: string; submittedAt: Date | null; approvedById: string | null; approvedAt: Date | null; autoApproved: boolean;
    rejectedById: string | null; rejectedAt: Date | null; rejectionReason: string | null; voidReason: string | null; voidedById: string | null; voidedAt: Date | null;
    journalId: string | null; version: number; createdAt: Date;
    lines: ExpenseLineEntity[]; payments: ExpensePaymentEntity[];
}

export interface ExpenseFilters {
    status?: ExpenseStatus; kind?: ExpenseKind; vendorId?: string; requestedById?: string; from?: string; to?: string; q?: string;
    overdueOn?: string;                    // bills still owing with a due date before this day
}

export interface RecurringLine { ledgerAccountId: string; description: string; amountKobo: bigint }

export interface RecurringEntity {
    id: string; vendorId: string | null; vendorName: string | null; kind: ExpenseKind; payFromAccountId: string | null; description: string;
    lines: RecurringLine[]; frequency: RecurrenceFrequency; startDate: Date; endDate: Date | null; nextRunDate: Date; lastRunAt: Date | null;
    autoApprove: boolean; isActive: boolean; createdById: string; createdAt: Date;
}

export interface BudgetLineEntity {
    id: string; budgetId: string; ledgerAccountId: string; accountCode: string | null; accountName: string | null; accountType: string | null;
    termId: string | null; plannedKobo: bigint; note: string | null;
}

export interface BudgetEntity {
    id: string; name: string; sessionId: string | null; startDate: Date; endDate: Date; status: BudgetStatus;
    createdById: string; createdAt: Date; lines: BudgetLineEntity[];
}
