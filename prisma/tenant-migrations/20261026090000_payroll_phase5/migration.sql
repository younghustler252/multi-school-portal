-- Finance phase 5: payroll (components, pay profiles, runs, payslips, loans, remittances). Amounts are whole kobo.

CREATE TYPE "PayComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');
CREATE TYPE "PayCalcType" AS ENUM ('FIXED', 'PERCENT_OF_BASIC', 'PERCENT_OF_GROSS', 'BANDED');
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED');
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'FINAL', 'PAID', 'VOID');
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLEARED', 'CANCELLED');

CREATE TABLE "PayComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PayComponentType" NOT NULL,
    "calcType" "PayCalcType" NOT NULL,
    "defaultValue" BIGINT NOT NULL DEFAULT 0,
    "bands" JSONB,
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,
    "isStatutory" BOOLEAN NOT NULL DEFAULT false,
    "expenseAccountId" TEXT,
    "liabilityAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "PayComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffPayProfile" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "basicSalaryKobo" BIGINT NOT NULL,
    "payFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "bankCode" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumberEncrypted" TEXT,
    "accountNumberLast4" TEXT,
    "taxId" TEXT,
    "pensionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffPayProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffPayComponent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "valueOverride" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "StaffPayComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "payDate" DATE NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "grossKobo" BIGINT NOT NULL DEFAULT 0,
    "deductionsKobo" BIGINT NOT NULL DEFAULT 0,
    "employerCostKobo" BIGINT NOT NULL DEFAULT 0,
    "netKobo" BIGINT NOT NULL DEFAULT 0,
    "staffCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paidOn" DATE,
    "paidFromAccountId" TEXT,
    "paymentReference" TEXT,
    "accrualJournalId" TEXT,
    "paymentJournalId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "payslipNumber" TEXT,
    "grossKobo" BIGINT NOT NULL,
    "totalDeductionsKobo" BIGINT NOT NULL,
    "netKobo" BIGINT NOT NULL,
    "employerContributionKobo" BIGINT NOT NULL DEFAULT 0,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "snapshot" JSONB,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COMPONENT',
    "componentId" TEXT,
    "loanId" TEXT,
    "label" TEXT NOT NULL,
    "type" "PayComponentType" NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "expenseAccountId" TEXT,
    "liabilityAccountId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffLoan" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "principalKobo" BIGINT NOT NULL,
    "balanceKobo" BIGINT NOT NULL,
    "monthlyRepaymentKobo" BIGINT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "approvedById" TEXT NOT NULL,
    "disbursedOn" DATE NOT NULL,
    "paidFromAccountId" TEXT NOT NULL,
    "disbursementJournalId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffLoan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffLoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffLoanRepayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRemittance" (
    "id" TEXT NOT NULL,
    "liabilityAccountId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "paidOn" DATE NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "journalId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRemittance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayComponent_code_key" ON "PayComponent"("code");
CREATE INDEX "PayComponent_type_idx" ON "PayComponent"("type");
CREATE INDEX "PayComponent_isActive_idx" ON "PayComponent"("isActive");
CREATE INDEX "PayComponent_deletedAt_idx" ON "PayComponent"("deletedAt");
CREATE INDEX "StaffPayProfile_staffId_effectiveFrom_idx" ON "StaffPayProfile"("staffId", "effectiveFrom");
CREATE UNIQUE INDEX "StaffPayComponent_profileId_componentId_key" ON "StaffPayComponent"("profileId", "componentId");
CREATE INDEX "StaffPayComponent_componentId_idx" ON "StaffPayComponent"("componentId");
CREATE UNIQUE INDEX "PayrollRun_runNumber_key" ON "PayrollRun"("runNumber");
CREATE UNIQUE INDEX "PayrollRun_accrualJournalId_key" ON "PayrollRun"("accrualJournalId");
CREATE UNIQUE INDEX "PayrollRun_paymentJournalId_key" ON "PayrollRun"("paymentJournalId");
CREATE INDEX "PayrollRun_periodYear_periodMonth_idx" ON "PayrollRun"("periodYear", "periodMonth");
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");
CREATE UNIQUE INDEX "Payslip_payslipNumber_key" ON "Payslip"("payslipNumber");
CREATE UNIQUE INDEX "Payslip_runId_staffId_key" ON "Payslip"("runId", "staffId");
CREATE INDEX "Payslip_staffId_idx" ON "Payslip"("staffId");
CREATE INDEX "PayslipLine_payslipId_idx" ON "PayslipLine"("payslipId");
CREATE UNIQUE INDEX "StaffLoan_disbursementJournalId_key" ON "StaffLoan"("disbursementJournalId");
CREATE INDEX "StaffLoan_staffId_idx" ON "StaffLoan"("staffId");
CREATE INDEX "StaffLoan_status_idx" ON "StaffLoan"("status");
CREATE UNIQUE INDEX "StaffLoanRepayment_loanId_payslipId_key" ON "StaffLoanRepayment"("loanId", "payslipId");
CREATE UNIQUE INDEX "PayrollRemittance_journalId_key" ON "PayrollRemittance"("journalId");
CREATE INDEX "PayrollRemittance_periodYear_periodMonth_idx" ON "PayrollRemittance"("periodYear", "periodMonth");

ALTER TABLE "StaffPayComponent" ADD CONSTRAINT "StaffPayComponent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffPayProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPayComponent" ADD CONSTRAINT "StaffPayComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_accrualJournalId_fkey" FOREIGN KEY ("accrualJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_paymentJournalId_fkey" FOREIGN KEY ("paymentJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_disbursementJournalId_fkey" FOREIGN KEY ("disbursementJournalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffLoanRepayment" ADD CONSTRAINT "StaffLoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "StaffLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRemittance" ADD CONSTRAINT "PayrollRemittance_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The rules the code also keeps, held by the database as a last line of defence
ALTER TABLE "StaffPayProfile" ADD CONSTRAINT "StaffPayProfile_basic_positive" CHECK ("basicSalaryKobo" > 0);
ALTER TABLE "StaffPayProfile" ADD CONSTRAINT "StaffPayProfile_dates_ordered" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_month_valid" CHECK ("periodMonth" BETWEEN 1 AND 12);
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_amounts_nonneg" CHECK ("grossKobo" >= 0 AND "deductionsKobo" >= 0 AND "netKobo" >= 0 AND "employerCostKobo" >= 0);
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_net_adds_up" CHECK ("netKobo" >= 0 AND "netKobo" = "grossKobo" - "totalDeductionsKobo");
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_amount_nonneg" CHECK ("amountKobo" >= 0);
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_amounts_valid" CHECK ("principalKobo" > 0 AND "monthlyRepaymentKobo" > 0 AND "balanceKobo" >= 0 AND "balanceKobo" <= "principalKobo");
ALTER TABLE "StaffLoan" ADD CONSTRAINT "StaffLoan_month_valid" CHECK ("startMonth" BETWEEN 1 AND 12);
ALTER TABLE "StaffLoanRepayment" ADD CONSTRAINT "StaffLoanRepayment_amount_positive" CHECK ("amountKobo" > 0);
ALTER TABLE "PayrollRemittance" ADD CONSTRAINT "PayrollRemittance_amount_positive" CHECK ("amountKobo" > 0);
