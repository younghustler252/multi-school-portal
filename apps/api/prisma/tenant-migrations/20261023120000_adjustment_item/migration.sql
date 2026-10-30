-- AlterTable
ALTER TABLE "InvoiceAdjustment" ADD COLUMN "invoiceItemId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_invoiceItemId_idx" ON "InvoiceAdjustment"("invoiceItemId");

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "FeeInvoiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
