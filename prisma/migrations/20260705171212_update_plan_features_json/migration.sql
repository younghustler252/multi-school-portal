/*
  Warnings:

  - You are about to drop the column `customGrading` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `multipleBranches` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `paymentCollection` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `prioritySupport` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `reportCardPdf` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `smsNotifications` on the `Plan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "customGrading",
DROP COLUMN "multipleBranches",
DROP COLUMN "paymentCollection",
DROP COLUMN "prioritySupport",
DROP COLUMN "reportCardPdf",
DROP COLUMN "smsNotifications",
ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupFeeKobo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "failedBillingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBillingAttemptAt" TIMESTAMP(3),
ADD COLUMN     "nextBillingDate" TIMESTAMP(3),
ADD COLUMN     "setupFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupFeePaidAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'active';
