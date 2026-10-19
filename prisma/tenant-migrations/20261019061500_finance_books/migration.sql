-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('FEE_INVOICE', 'PAYMENT', 'REFUND', 'ADJUSTMENT', 'EXPENSE_BILL', 'EXPENSE_PAYMENT', 'PAYROLL_ACCRUAL', 'PAYROLL_PAYMENT', 'PAYROLL_REMITTANCE', 'TRANSFER', 'OPENING_BALANCE', 'MANUAL', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerPartyType" AS ENUM ('STUDENT', 'GUARDIAN', 'VENDOR', 'STAFF');

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT 'GENERAL',
    "systemKey" TEXT,
    "parentId" TEXT,
    "description" TEXT,
    "isMoneyAccount" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumberLast4" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "periodId" TEXT NOT NULL,
    "termId" TEXT,
    "sessionId" TEXT,
    "branchId" TEXT,
    "description" TEXT NOT NULL,
    "sourceType" "JournalSourceType" NOT NULL,
    "sourceId" TEXT,
    "purpose" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'POSTED',
    "reversalOfId" TEXT,
    "reversalReason" TEXT,
    "totalKobo" BIGINT NOT NULL,
    "createdById" TEXT,
    "isSystemActor" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "debitKobo" BIGINT NOT NULL DEFAULT 0,
    "creditKobo" BIGINT NOT NULL DEFAULT 0,
    "memo" TEXT,
    "partyType" "LedgerPartyType",
    "partyId" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_systemKey_key" ON "LedgerAccount"("systemKey");

-- CreateIndex
CREATE INDEX "LedgerAccount_type_idx" ON "LedgerAccount"("type");

-- CreateIndex
CREATE INDEX "LedgerAccount_parentId_idx" ON "LedgerAccount"("parentId");

-- CreateIndex
CREATE INDEX "LedgerAccount_isActive_idx" ON "LedgerAccount"("isActive");

-- CreateIndex
CREATE INDEX "LedgerAccount_deletedAt_idx" ON "LedgerAccount"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriod_name_key" ON "FinancePeriod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriod_startDate_key" ON "FinancePeriod"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_idempotencyKey_key" ON "JournalEntry"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalOfId_key" ON "JournalEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "JournalEntry_periodId_idx" ON "JournalEntry"("periodId");

-- CreateIndex
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_termId_idx" ON "JournalEntry"("termId");

-- CreateIndex
CREATE INDEX "JournalEntry_branchId_idx" ON "JournalEntry"("branchId");

-- CreateIndex
CREATE INDEX "JournalLine_ledgerAccountId_journalId_idx" ON "JournalLine"("ledgerAccountId", "journalId");

-- CreateIndex
CREATE INDEX "JournalLine_partyType_partyId_idx" ON "JournalLine"("partyType", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_journalId_lineNumber_key" ON "JournalLine"("journalId", "lineNumber");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- HAND-WRITTEN BELOW (Prisma cannot express these; keep them when regenerating)
-- Database rules that keep the books honest even if application code has a bug.
-- ===========================================================================

-- A line moves exactly one side, by a positive amount
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_one_side_check"
    CHECK (("debitKobo" > 0 AND "creditKobo" = 0) OR ("debitKobo" = 0 AND "creditKobo" > 0));

-- A party needs both its type and its id, or neither
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_party_pair_check"
    CHECK (("partyType" IS NULL) = ("partyId" IS NULL));

ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_line_number_check"
    CHECK ("lineNumber" > 0);

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_total_check"
    CHECK ("totalKobo" > 0);

-- A reversal is a REVERSAL journal that points at another journal, and only those do
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversal_check"
    CHECK (("reversalOfId" IS NOT NULL) = ("sourceType" = 'REVERSAL') AND "reversalOfId" IS DISTINCT FROM "id");

ALTER TABLE "FinancePeriod" ADD CONSTRAINT "FinancePeriod_dates_check"
    CHECK ("endDate" >= "startDate");

-- A posted journal cannot be deleted or edited. Only status may change, and only POSTED -> REVERSED.
CREATE FUNCTION "finance_block_journal_changes"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A posted journal cannot be deleted. Post a reversal instead.';
    END IF;
    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
        RAISE EXCEPTION 'A posted journal cannot be edited. Only its status can change, when it is reversed.';
    END IF;
    IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED') THEN
        RAISE EXCEPTION 'A journal can only change from POSTED to REVERSED.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "JournalEntry_immutable" BEFORE UPDATE OR DELETE ON "JournalEntry"
    FOR EACH ROW EXECUTE FUNCTION "finance_block_journal_changes"();

-- Journal lines can never be changed or deleted after they are saved
CREATE FUNCTION "finance_block_line_changes"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Journal lines cannot be changed or deleted after posting. Post a reversal instead.';
    RETURN NULL;
END;
$$;

CREATE TRIGGER "JournalLine_immutable" BEFORE UPDATE OR DELETE ON "JournalLine"
    FOR EACH ROW EXECUTE FUNCTION "finance_block_line_changes"();

-- When the transaction commits, every journal must have at least two lines, debits equal to credits,
-- and a total equal to its debits. (Checked at commit, so the lines may be saved one by one first.)
CREATE FUNCTION "finance_assert_journal_balanced"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    journal_id TEXT;
    line_count INTEGER;
    debits     NUMERIC;
    credits    NUMERIC;
    total      BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'JournalEntry' THEN
        journal_id := NEW."id";
    ELSE
        journal_id := NEW."journalId";
    END IF;

    SELECT COUNT(*), COALESCE(SUM("debitKobo"), 0), COALESCE(SUM("creditKobo"), 0)
      INTO line_count, debits, credits
      FROM "JournalLine" WHERE "journalId" = journal_id;

    SELECT "totalKobo" INTO total FROM "JournalEntry" WHERE "id" = journal_id;

    IF line_count < 2 THEN
        RAISE EXCEPTION 'Journal % needs at least two lines (it has %).', journal_id, line_count;
    END IF;
    IF debits <> credits THEN
        RAISE EXCEPTION 'Journal % is not balanced: debits % and credits %.', journal_id, debits, credits;
    END IF;
    IF total <> debits THEN
        RAISE EXCEPTION 'Journal % total % does not match its debits %.', journal_id, total, debits;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "JournalEntry_balanced" AFTER INSERT ON "JournalEntry"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_assert_journal_balanced"();

CREATE CONSTRAINT TRIGGER "JournalLine_balanced" AFTER INSERT ON "JournalLine"
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "finance_assert_journal_balanced"();
