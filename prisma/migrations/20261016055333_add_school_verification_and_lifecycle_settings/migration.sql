-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "unconfirmedRegistrationHours" INTEGER NOT NULL DEFAULT 72,
ADD COLUMN     "unverifiedSchoolRetentionDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "unverifiedSchoolTrialDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "settlementAccountLast4" TEXT,
ADD COLUMN     "settlementAccountName" TEXT,
ADD COLUMN     "verificationNote" TEXT;

-- CreateIndex
CREATE INDEX "School_status_activatedAt_idx" ON "School"("status", "activatedAt");
