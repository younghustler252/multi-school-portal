-- Finance phase 6: bank reconciliation (statements, bank lines, pairings, month sign-off). Amounts are whole kobo.
-- Bank lines are signed: money in is positive, money out is negative.

CREATE TYPE "BankMatchKind" AS ENUM ('AUTO', 'MANUAL', 'CREATED', 'CLEARED');

CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "fileName" TEXT,
    "fileHash" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "openingBalanceKobo" BIGINT,
    "closingBalanceKobo" BIGINT,
    "lineCount" INTEGER NOT NULL,
    "importedById" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BankStatement_dates_check" CHECK ("endDate" >= "startDate"),
    CONSTRAINT "BankStatement_lineCount_check" CHECK ("lineCount" > 0)
);

CREATE TABLE "BankMatchGroup" (
    "id" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "kind" "BankMatchKind" NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankMatchGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "txnDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amountKobo" BIGINT NOT NULL,
    "balanceKobo" BIGINT,
    "dedupeKey" TEXT NOT NULL,
    "matchGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BankStatementLine_amount_check" CHECK ("amountKobo" <> 0)
);

CREATE TABLE "BankMatchedJournalLine" (
    "journalLineId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "BankMatchedJournalLine_pkey" PRIMARY KEY ("journalLineId")
);

CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "statementBalanceKobo" BIGINT NOT NULL,
    "bookBalanceKobo" BIGINT NOT NULL,
    "outstandingBookKobo" BIGINT NOT NULL,
    "note" TEXT,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankStatement_ledgerAccountId_fileHash_key" ON "BankStatement"("ledgerAccountId", "fileHash");
CREATE INDEX "BankStatement_ledgerAccountId_endDate_idx" ON "BankStatement"("ledgerAccountId", "endDate");
CREATE INDEX "BankMatchGroup_ledgerAccountId_createdAt_idx" ON "BankMatchGroup"("ledgerAccountId", "createdAt");
CREATE UNIQUE INDEX "BankStatementLine_ledgerAccountId_dedupeKey_key" ON "BankStatementLine"("ledgerAccountId", "dedupeKey");
CREATE INDEX "BankStatementLine_ledgerAccountId_txnDate_idx" ON "BankStatementLine"("ledgerAccountId", "txnDate");
CREATE INDEX "BankStatementLine_statementId_idx" ON "BankStatementLine"("statementId");
CREATE INDEX "BankStatementLine_matchGroupId_idx" ON "BankStatementLine"("matchGroupId");
CREATE INDEX "BankMatchedJournalLine_groupId_idx" ON "BankMatchedJournalLine"("groupId");
CREATE UNIQUE INDEX "BankReconciliation_ledgerAccountId_periodId_key" ON "BankReconciliation"("ledgerAccountId", "periodId");
CREATE INDEX "BankReconciliation_periodId_idx" ON "BankReconciliation"("periodId");

ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankMatchGroup" ADD CONSTRAINT "BankMatchGroup_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_matchGroupId_fkey" FOREIGN KEY ("matchGroupId") REFERENCES "BankMatchGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankMatchedJournalLine" ADD CONSTRAINT "BankMatchedJournalLine_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BankMatchGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankMatchedJournalLine" ADD CONSTRAINT "BankMatchedJournalLine_journalLineId_fkey" FOREIGN KEY ("journalLineId") REFERENCES "JournalLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
