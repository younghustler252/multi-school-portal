-- A late fee invoice points at the overdue invoice it was charged for; an invoice can be charged a late fee once.
ALTER TABLE "FeeInvoice" ADD COLUMN "lateFeeOfInvoiceId" TEXT;
CREATE UNIQUE INDEX "FeeInvoice_lateFeeOfInvoiceId_key" ON "FeeInvoice"("lateFeeOfInvoiceId");
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_lateFeeOfInvoiceId_fkey" FOREIGN KEY ("lateFeeOfInvoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
