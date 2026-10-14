/*
  Warnings:

  - You are about to drop the column `guardianId` on the `SchoolNotificationRecipient` table. All the data in the column will be lost.
  - You are about to drop the column `staffId` on the `SchoolNotificationRecipient` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `SchoolNotificationRecipient` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `SchoolNotificationRecipient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[notificationId,channel,recipientType,recipientEntityId]` on the table `SchoolNotificationRecipient` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `recipientEntityId` to the `SchoolNotificationRecipient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientType` to the `SchoolNotificationRecipient` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('STAFF', 'STUDENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'ASSIGNED', 'OWN');

-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('SYSTEM_LOCKED', 'SYSTEM_EDITABLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'suspended', 'removed');

-- CreateEnum
CREATE TYPE "StaffCategory" AS ENUM ('teaching', 'non_teaching');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('STUDENT', 'GUARDIAN', 'STAFF');

-- DropIndex
DROP INDEX "SchoolNotificationRecipient_notificationId_channel_studentI_key";

-- AlterTable
ALTER TABLE "SchoolNotificationRecipient" DROP COLUMN "guardianId",
DROP COLUMN "staffId",
DROP COLUMN "studentId",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "queuedAt" TIMESTAMP(3),
ADD COLUMN     "recipientEntityId" TEXT NOT NULL,
ADD COLUMN     "recipientType" "RecipientType" NOT NULL,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "category" "StaffCategory" NOT NULL DEFAULT 'non_teaching';

-- CreateTable
CREATE TABLE "SchoolRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "RoleKind" NOT NULL,
    "persona" "Persona" NOT NULL DEFAULT 'STAFF',
    "grantsAll" BOOLEAN NOT NULL DEFAULT false,
    "sourceTemplateKey" TEXT,
    "sourceTemplateVersion" INTEGER,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolRolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "SchoolRolePermission_pkey" PRIMARY KEY ("roleId","permissionKey")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "persona" "Persona" NOT NULL,
    "personaEntityId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRole" (
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "MembershipRole_pkey" PRIMARY KEY ("membershipId","roleId")
);

-- CreateTable
CREATE TABLE "SchoolSettingValue" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSettingValue_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "definitionKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB NOT NULL,
    "channels" "NotificationChannel"[],
    "audience" JSONB,
    "templateKey" TEXT,
    "schedule" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "notified" INTEGER NOT NULL DEFAULT 0,
    "skippedReason" TEXT,
    "error" TEXT,
    "notificationId" TEXT,

    CONSTRAINT "AutomationRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumberSequence" (
    "key" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT '',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("key","period")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolRole_sourceTemplateKey_idx" ON "SchoolRole"("sourceTemplateKey");

-- CreateIndex
CREATE INDEX "SchoolRolePermission_permissionKey_idx" ON "SchoolRolePermission"("permissionKey");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_persona_key" ON "Membership"("userId", "persona");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_persona_personaEntityId_key" ON "Membership"("persona", "personaEntityId");

-- CreateIndex
CREATE INDEX "MembershipRole_roleId_idx" ON "MembershipRole"("roleId");

-- CreateIndex
CREATE INDEX "AutomationRule_definitionKey_idx" ON "AutomationRule"("definitionKey");

-- CreateIndex
CREATE INDEX "AutomationRule_enabled_nextRunAt_idx" ON "AutomationRule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationRunLog_ruleId_triggeredAt_idx" ON "AutomationRunLog"("ruleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "SchoolMessageTemplate_isActive_idx" ON "SchoolMessageTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMessageTemplate_key_channel_locale_key" ON "SchoolMessageTemplate"("key", "channel", "locale");

-- CreateIndex
CREATE INDEX "Attachment_ownerType_ownerId_idx" ON "Attachment"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Attachment_deletedAt_idx" ON "Attachment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolNotificationRecipient_idempotencyKey_key" ON "SchoolNotificationRecipient"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SchoolNotificationRecipient_recipientType_recipientEntityId_idx" ON "SchoolNotificationRecipient"("recipientType", "recipientEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolNotificationRecipient_notificationId_channel_recipien_key" ON "SchoolNotificationRecipient"("notificationId", "channel", "recipientType", "recipientEntityId");

-- AddForeignKey
ALTER TABLE "SchoolRolePermission" ADD CONSTRAINT "SchoolRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SchoolRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SchoolRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunLog" ADD CONSTRAINT "AutomationRunLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
