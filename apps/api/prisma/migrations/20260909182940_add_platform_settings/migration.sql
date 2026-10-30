-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'SchoolPortal',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@schoolportal.com',
    "supportPhone" TEXT,
    "logoUrl" TEXT,
    "termsUrl" TEXT,
    "privacyPolicyUrl" TEXT,
    "subscriptionGracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "reminderDaysBeforeExpiry" INTEGER NOT NULL DEFAULT 7,
    "defaultTrialDays" INTEGER NOT NULL DEFAULT 0,
    "allowNewRegistrations" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "announcementBanner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
