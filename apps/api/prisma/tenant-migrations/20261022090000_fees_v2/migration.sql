-- Fees v2. No real data exists, so the old fee and payment tables are replaced, not converted.

-- DropTable
DROP TABLE "Payment";
DROP TABLE "FeeInvoiceItem";
DROP TABLE "FeeInvoice";
DROP TABLE "FeeType";

-- DropEnum
DROP TYPE "PaymentStatus";
DROP TYPE "PaymentMethod";
DROP TYPE "InvoiceStatus";

-- CreateEnum
CREATE TYPE "FeeStudentType" AS ENUM ('ALL', 'NEW', 'RETURNING');
CREATE TYPE "InvoiceType" AS ENUM ('TERM_FEES', 'ADMISSION', 'ADHOC', 'OPENING_BALANCE');
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'unpaid', 'partial', 'paid', 'waived', 'void');
CREATE TYPE "FeeDiscountType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "FeeDiscountKind" AS ENUM ('SIBLING', 'STAFF_CHILD', 'SCHOLARSHIP', 'EARLY_PAYMENT', 'CUSTOM');
CREATE TYPE "AdjustmentType" AS ENUM ('WAIVER', 'WRITE_OFF', 'CREDIT_NOTE', 'ADDITIONAL_DISCOUNT');
CREATE TYPE "InvoiceAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "InstalmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PaymentPayerType" AS ENUM ('GUARDIAN', 'STUDENT', 'OTHER');
CREATE TYPE "PaymentMethod" AS ENUM ('paystack', 'flutterwave', 'bank_transfer', 'cash', 'cheque', 'pos', 'other');
CREATE TYPE "FeePaymentStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'FAILED', 'REVERSED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "FeeType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "incomeAccountId" TEXT NOT NULL,
    "isRefundable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "FeeType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT,
    "branchId" TEXT,
    "studentType" "FeeStudentType" NOT NULL DEFAULT 'ALL',
    "dueDate" DATE,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeStructureItem" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeStructureItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "type" "InvoiceType" NOT NULL DEFAULT 'TERM_FEES',
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "termId" TEXT,
    "classId" TEXT,
    "branchId" TEXT,
    "sourceStructureId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "issueDate" DATE,
    "dueDate" DATE,
    "subtotalKobo" BIGINT NOT NULL DEFAULT 0,
    "discountKobo" BIGINT NOT NULL DEFAULT 0,
    "adjustmentsKobo" BIGINT NOT NULL DEFAULT 0,
    "totalKobo" BIGINT NOT NULL DEFAULT 0,
    "paidKobo" BIGINT NOT NULL DEFAULT 0,
    "balanceKobo" BIGINT NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "feeTypeId" TEXT,
    "description" TEXT NOT NULL,
    "incomeAccountId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeInvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeDiscountRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FeeDiscountKind" NOT NULL DEFAULT 'CUSTOM',
    "type" "FeeDiscountType" NOT NULL,
    "value" BIGINT NOT NULL,
    "feeTypeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "FeeDiscountRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentDiscount" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sessionId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "StudentDiscount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceAdjustment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "InvoiceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstalmentPlan" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "InstalmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstalmentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstalmentLine" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    CONSTRAINT "InstalmentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "payerType" "PaymentPayerType" NOT NULL DEFAULT 'GUARDIAN',
    "guardianId" TEXT,
    "payerName" TEXT,
    "payerPhone" TEXT,
    "branchId" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "channel" TEXT,
    "amountKobo" BIGINT NOT NULL,
    "unallocatedKobo" BIGINT NOT NULL DEFAULT 0,
    "accountId" TEXT NOT NULL,
    "status" "FeePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "gatewayReference" TEXT,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "providerResponse" JSONB,
    "proofAttachmentId" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "journalId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversalReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "studentId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT,
    "amountKobo" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "payoutAccountId" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeType_code_key" ON "FeeType"("code");
CREATE INDEX "FeeType_incomeAccountId_idx" ON "FeeType"("incomeAccountId");
CREATE INDEX "FeeType_isActive_idx" ON "FeeType"("isActive");
CREATE INDEX "FeeType_deletedAt_idx" ON "FeeType"("deletedAt");

CREATE INDEX "FeeStructure_termId_classId_idx" ON "FeeStructure"("termId", "classId");
CREATE INDEX "FeeStructure_sessionId_idx" ON "FeeStructure"("sessionId");
CREATE INDEX "FeeStructure_branchId_idx" ON "FeeStructure"("branchId");
CREATE INDEX "FeeStructure_deletedAt_idx" ON "FeeStructure"("deletedAt");

CREATE UNIQUE INDEX "FeeStructureItem_structureId_feeTypeId_key" ON "FeeStructureItem"("structureId", "feeTypeId");
CREATE INDEX "FeeStructureItem_feeTypeId_idx" ON "FeeStructureItem"("feeTypeId");

CREATE UNIQUE INDEX "FeeInvoice_invoiceNumber_key" ON "FeeInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "FeeInvoice_journalId_key" ON "FeeInvoice"("journalId");
CREATE INDEX "FeeInvoice_studentId_status_idx" ON "FeeInvoice"("studentId", "status");
CREATE INDEX "FeeInvoice_termId_status_idx" ON "FeeInvoice"("termId", "status");
CREATE INDEX "FeeInvoice_status_dueDate_idx" ON "FeeInvoice"("status", "dueDate");
CREATE INDEX "FeeInvoice_branchId_idx" ON "FeeInvoice"("branchId");
CREATE INDEX "FeeInvoice_sourceStructureId_idx" ON "FeeInvoice"("sourceStructureId");

CREATE INDEX "FeeInvoiceItem_invoiceId_idx" ON "FeeInvoiceItem"("invoiceId");
CREATE INDEX "FeeInvoiceItem_feeTypeId_idx" ON "FeeInvoiceItem"("feeTypeId");
CREATE INDEX "FeeInvoiceItem_incomeAccountId_idx" ON "FeeInvoiceItem"("incomeAccountId");

CREATE INDEX "FeeDiscountRule_isActive_idx" ON "FeeDiscountRule"("isActive");
CREATE INDEX "FeeDiscountRule_deletedAt_idx" ON "FeeDiscountRule"("deletedAt");

CREATE INDEX "StudentDiscount_studentId_idx" ON "StudentDiscount"("studentId");
CREATE INDEX "StudentDiscount_ruleId_idx" ON "StudentDiscount"("ruleId");
CREATE INDEX "StudentDiscount_sessionId_idx" ON "StudentDiscount"("sessionId");

CREATE UNIQUE INDEX "InvoiceAdjustment_journalId_key" ON "InvoiceAdjustment"("journalId");
CREATE INDEX "InvoiceAdjustment_invoiceId_idx" ON "InvoiceAdjustment"("invoiceId");
CREATE INDEX "InvoiceAdjustment_status_idx" ON "InvoiceAdjustment"("status");

CREATE UNIQUE INDEX "InstalmentPlan_invoiceId_key" ON "InstalmentPlan"("invoiceId");

CREATE UNIQUE INDEX "InstalmentLine_planId_lineNumber_key" ON "InstalmentLine"("planId", "lineNumber");
CREATE INDEX "InstalmentLine_dueDate_idx" ON "InstalmentLine"("dueDate");

CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE UNIQUE INDEX "Payment_journalId_key" ON "Payment"("journalId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_guardianId_idx" ON "Payment"("guardianId");
CREATE INDEX "Payment_accountId_idx" ON "Payment"("accountId");
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");
CREATE INDEX "PaymentAllocation_studentId_idx" ON "PaymentAllocation"("studentId");

CREATE UNIQUE INDEX "Refund_journalId_key" ON "Refund"("journalId");
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
CREATE INDEX "Refund_studentId_idx" ON "Refund"("studentId");

CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- AddForeignKey
ALTER TABLE "FeeType" ADD CONSTRAINT "FeeType_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_sourceStructureId_fkey" FOREIGN KEY ("sourceStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeDiscountRule" ADD CONSTRAINT "FeeDiscountRule_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "FeeDiscountRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InstalmentPlan" ADD CONSTRAINT "InstalmentPlan_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InstalmentLine" ADD CONSTRAINT "InstalmentLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstalmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_proofAttachmentId_fkey" FOREIGN KEY ("proofAttachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rules the database enforces on its own (Prisma cannot express these).
-- ─────────────────────────────────────────────────────────────────────────────

-- One live invoice per student per fee structure. A voided one does not block a new one.
CREATE UNIQUE INDEX "FeeInvoice_student_structure_live_key"
    ON "FeeInvoice"("studentId", "sourceStructureId")
    WHERE "sourceStructureId" IS NOT NULL AND "status" <> 'void';

ALTER TABLE "FeeStructureItem" ADD CONSTRAINT "FeeStructureItem_amount_positive" CHECK ("amountKobo" > 0);

ALTER TABLE "FeeInvoice"
    ADD CONSTRAINT "FeeInvoice_amounts_nonneg" CHECK ("subtotalKobo" >= 0 AND "discountKobo" >= 0 AND "totalKobo" >= 0 AND "paidKobo" >= 0 AND "balanceKobo" >= 0),
    ADD CONSTRAINT "FeeInvoice_total_adds_up" CHECK ("totalKobo" = "subtotalKobo" - "discountKobo" + "adjustmentsKobo"),
    ADD CONSTRAINT "FeeInvoice_balance_adds_up" CHECK ("balanceKobo" = "totalKobo" - "paidKobo"),
    ADD CONSTRAINT "FeeInvoice_number_when_issued" CHECK (("status" = 'draft') = ("invoiceNumber" IS NULL) OR "status" = 'void'),
    ADD CONSTRAINT "FeeInvoice_void_has_time" CHECK (("status" = 'void') = ("voidedAt" IS NOT NULL));

ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_amount_nonneg" CHECK ("amountKobo" >= 0);

ALTER TABLE "FeeDiscountRule" ADD CONSTRAINT "FeeDiscountRule_value_valid" CHECK (
    ("type" = 'PERCENT' AND "value" BETWEEN 1 AND 10000) OR ("type" = 'FIXED' AND "value" > 0)
);

ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_amount_positive" CHECK ("amountKobo" > 0);
ALTER TABLE "InstalmentLine" ADD CONSTRAINT "InstalmentLine_amount_positive" CHECK ("amountKobo" > 0);

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_amount_positive" CHECK ("amountKobo" > 0),
    ADD CONSTRAINT "Payment_unallocated_in_range" CHECK ("unallocatedKobo" >= 0 AND "unallocatedKobo" <= "amountKobo");

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amountKobo" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive" CHECK ("amountKobo" > 0);
