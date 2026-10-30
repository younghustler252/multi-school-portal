/*
  Warnings:

  - You are about to drop the column `amountKobo` on the `FeeInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `balanceKobo` on the `FeeInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `feeTypeId` on the `FeeInvoice` table. All the data in the column will be lost.
  - You are about to drop the column `paidKobo` on the `FeeInvoice` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,termId]` on the table `FeeInvoice` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "FeeInvoice" DROP CONSTRAINT "FeeInvoice_feeTypeId_fkey";

-- AlterTable
ALTER TABLE "FeeInvoice" DROP COLUMN "amountKobo",
DROP COLUMN "balanceKobo",
DROP COLUMN "feeTypeId",
DROP COLUMN "paidKobo",
ADD COLUMN     "discountKobo" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FeeInvoiceItem" (
    "id" TEXT NOT NULL,
    "feeInvoiceId" TEXT NOT NULL,
    "feeTypeId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeInvoice_studentId_termId_key" ON "FeeInvoice"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_feeInvoiceId_fkey" FOREIGN KEY ("feeInvoiceId") REFERENCES "FeeInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeInvoiceItem" ADD CONSTRAINT "FeeInvoiceItem_feeTypeId_fkey" FOREIGN KEY ("feeTypeId") REFERENCES "FeeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
