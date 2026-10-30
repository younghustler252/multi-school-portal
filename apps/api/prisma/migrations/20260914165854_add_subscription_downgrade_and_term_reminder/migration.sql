-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "termEndingReminderDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "scheduledDowngradePlanId" TEXT;
