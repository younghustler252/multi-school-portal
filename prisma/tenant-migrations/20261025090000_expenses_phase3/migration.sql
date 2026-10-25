-- Finance phase 3: vendors, expenses and bills, payments out, recurring expenses, budgets.

CREATE TYPE "ExpenseKind" AS ENUM ('DIRECT', 'BILL');
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'REJECTED', 'VOID');
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'TERMLY', 'YEARLY');
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumberEncrypted" TEXT,
    "accountNumberLast4" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT,
    "kind" "ExpenseKind" NOT NULL,
    "vendorId" TEXT,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "dueDate" DATE,
    "totalKobo" BIGINT NOT NULL,
    "paidKobo" BIGINT NOT NULL DEFAULT 0,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "payFromAccountId" TEXT,
    "termId" TEXT,
    "branchId" TEXT,
    "recurringExpenseId" TEXT,
    "requestedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "voidReason" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "journalId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "paidOn" DATE NOT NULL,
    "accountId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidById" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "kind" "ExpenseKind" NOT NULL DEFAULT 'BILL',
    "payFromAccountId" TEXT,
    "description" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextRunDate" DATE NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "termId" TEXT,
    "plannedKobo" BIGINT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");
CREATE INDEX "Vendor_isActive_idx" ON "Vendor"("isActive");
CREATE INDEX "Vendor_deletedAt_idx" ON "Vendor"("deletedAt");
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "Expense"("expenseNumber");
CREATE UNIQUE INDEX "Expense_journalId_key" ON "Expense"("journalId");
CREATE INDEX "Expense_status_idx" ON "Expense"("status");
CREATE INDEX "Expense_kind_idx" ON "Expense"("kind");
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_dueDate_idx" ON "Expense"("dueDate");
CREATE INDEX "Expense_requestedById_idx" ON "Expense"("requestedById");
CREATE INDEX "Expense_recurringExpenseId_idx" ON "Expense"("recurringExpenseId");
CREATE UNIQUE INDEX "Expense_recurringExpenseId_expenseDate_key" ON "Expense"("recurringExpenseId", "expenseDate");
CREATE INDEX "ExpenseLine_expenseId_idx" ON "ExpenseLine"("expenseId");
CREATE INDEX "ExpenseLine_ledgerAccountId_idx" ON "ExpenseLine"("ledgerAccountId");
CREATE UNIQUE INDEX "ExpensePayment_journalId_key" ON "ExpensePayment"("journalId");
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");
CREATE INDEX "ExpensePayment_paidOn_idx" ON "ExpensePayment"("paidOn");
CREATE INDEX "ExpensePayment_accountId_idx" ON "ExpensePayment"("accountId");
CREATE INDEX "RecurringExpense_isActive_nextRunDate_idx" ON "RecurringExpense"("isActive", "nextRunDate");
CREATE INDEX "Budget_status_idx" ON "Budget"("status");
CREATE INDEX "Budget_startDate_endDate_idx" ON "Budget"("startDate", "endDate");
CREATE INDEX "Budget_deletedAt_idx" ON "Budget"("deletedAt");
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");
CREATE INDEX "BudgetLine_ledgerAccountId_idx" ON "BudgetLine"("ledgerAccountId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payFromAccountId_fkey" FOREIGN KEY ("payFromAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_payFromAccountId_fkey" FOREIGN KEY ("payFromAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules the database keeps by itself (Prisma cannot express them)
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_total_positive" CHECK ("totalKobo" > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paid_within_total" CHECK ("paidKobo" >= 0 AND "paidKobo" <= "totalKobo");
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_amount_positive" CHECK ("amountKobo" > 0);
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_amount_positive" CHECK ("amountKobo" > 0);
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_planned_positive" CHECK ("plannedKobo" > 0);
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_dates_in_order" CHECK ("endDate" >= "startDate");
