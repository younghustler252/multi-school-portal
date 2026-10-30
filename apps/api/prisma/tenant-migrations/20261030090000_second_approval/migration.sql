-- Finance phase 6: optional second approver above an amount (setting finance.second_approval_threshold_kobo, off by default).
-- The first approval is only recorded here; the second approval (a different person) posts to the books.
ALTER TABLE "Expense" ADD COLUMN "firstApprovedById" TEXT;
ALTER TABLE "Expense" ADD COLUMN "firstApprovedAt" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN "firstApprovedById" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN "firstApprovedAt" TIMESTAMP(3);
