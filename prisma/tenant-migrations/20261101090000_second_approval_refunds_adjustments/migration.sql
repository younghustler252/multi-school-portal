-- Finance phase 6: second approver (setting finance.second_approval_threshold_kobo) also covers refunds and fee adjustments.
ALTER TABLE "Refund" ADD COLUMN "firstApprovedById" TEXT;
ALTER TABLE "Refund" ADD COLUMN "firstApprovedAt" TIMESTAMP(3);
ALTER TABLE "InvoiceAdjustment" ADD COLUMN "firstApprovedById" TEXT;
ALTER TABLE "InvoiceAdjustment" ADD COLUMN "firstApprovedAt" TIMESTAMP(3);
