-- Finance phase 6: salary transfers (money out through the payment provider). Amounts are whole kobo.
-- A row is made BEFORE the provider is called. At most one live (not failed, reversed or cancelled) transfer per payslip.

CREATE TYPE "SalaryTransferStatus" AS ENUM ('PENDING', 'SENDING', 'PROCESSING', 'UNKNOWN', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED');

CREATE TABLE "SalaryTransfer" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "reference" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "status" "SalaryTransferStatus" NOT NULL DEFAULT 'PENDING',
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT,
    "accountName" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "recipientCode" TEXT,
    "transferCode" TEXT,
    "fromAccountId" TEXT NOT NULL,
    "failureReason" TEXT,
    "initiatedById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "journalId" TEXT,
    "reversalJournalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalaryTransfer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalaryTransfer_amount_check" CHECK ("amountKobo" > 0),
    CONSTRAINT "SalaryTransfer_attempt_check" CHECK ("attempt" >= 1)
);

CREATE UNIQUE INDEX "SalaryTransfer_reference_key" ON "SalaryTransfer"("reference");
CREATE UNIQUE INDEX "SalaryTransfer_journalId_key" ON "SalaryTransfer"("journalId");
CREATE UNIQUE INDEX "SalaryTransfer_payslipId_attempt_key" ON "SalaryTransfer"("payslipId", "attempt");
CREATE UNIQUE INDEX "SalaryTransfer_one_live_per_payslip" ON "SalaryTransfer"("payslipId") WHERE "status" IN ('PENDING', 'SENDING', 'PROCESSING', 'UNKNOWN', 'SUCCESS');
CREATE INDEX "SalaryTransfer_runId_idx" ON "SalaryTransfer"("runId");
CREATE INDEX "SalaryTransfer_status_idx" ON "SalaryTransfer"("status");

ALTER TABLE "SalaryTransfer" ADD CONSTRAINT "SalaryTransfer_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryTransfer" ADD CONSTRAINT "SalaryTransfer_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryTransfer" ADD CONSTRAINT "SalaryTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryTransfer" ADD CONSTRAINT "SalaryTransfer_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
