-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "targetStudentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clientRequestId_key" ON "Payment"("clientRequestId");
