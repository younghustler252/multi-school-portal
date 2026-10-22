-- CreateTable
CREATE TABLE "FeeInvoiceDiscount" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "ruleId" TEXT,
    "feeTypeId" TEXT,
    "label" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeInvoiceDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeInvoiceDiscount_invoiceId_idx" ON "FeeInvoiceDiscount"("invoiceId");
CREATE INDEX "FeeInvoiceDiscount_ruleId_idx" ON "FeeInvoiceDiscount"("ruleId");

-- AddForeignKey
ALTER TABLE "FeeInvoiceDiscount" ADD CONSTRAINT "FeeInvoiceDiscount_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceDiscount" ADD CONSTRAINT "FeeInvoiceDiscount_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "FeeDiscountRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeeInvoiceDiscount" ADD CONSTRAINT "FeeInvoiceDiscount_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks the database enforces
ALTER TABLE "FeeInvoiceDiscount" ADD CONSTRAINT "FeeInvoiceDiscount_amount_positive" CHECK ("amountKobo" > 0);
