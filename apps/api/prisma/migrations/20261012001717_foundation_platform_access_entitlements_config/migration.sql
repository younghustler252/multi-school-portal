/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `PlatformNotificationRecipient` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LegacyPlatformRole" AS ENUM ('super_admin');

-- CreateEnum
CREATE TYPE "Persona" AS ENUM ('STAFF', 'STUDENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'suspended', 'removed');

-- CreateEnum
CREATE TYPE "PlatformRoleKind" AS ENUM ('LOCKED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'ASSIGNED', 'OWN');

-- CreateEnum
CREATE TYPE "PermissionRealm" AS ENUM ('PLATFORM', 'SCHOOL');

-- CreateEnum
CREATE TYPE "FeatureKind" AS ENUM ('BOOLEAN', 'LIMIT', 'QUOTA', 'ENUM');

-- CreateEnum
CREATE TYPE "Enforcement" AS ENUM ('BLOCK', 'WARN');

-- CreateEnum
CREATE TYPE "DefinitionOrigin" AS ENUM ('CODE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('BOOLEAN', 'INTEGER', 'DECIMAL', 'STRING', 'ENUM', 'TIME', 'STRING_LIST', 'INTEGER_LIST', 'ENTITY_REF');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('EVENT', 'SCHEDULE', 'OFFSET_BEFORE', 'OFFSET_AFTER');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('AUTH', 'BILLING', 'SYSTEM', 'FEES', 'ACADEMIC', 'ATTENDANCE', 'GENERAL');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorMembershipId" TEXT,
ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "module" TEXT,
ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "persona" "Persona" NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "roleKey" TEXT;

-- AlterTable
ALTER TABLE "PlatformNotificationRecipient" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "providerMsgId" TEXT,
ADD COLUMN     "queuedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "defaultCountry" TEXT NOT NULL DEFAULT 'Nigeria',
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
ADD COLUMN     "defaultLocale" TEXT NOT NULL DEFAULT 'en-NG',
ADD COLUMN     "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
ADD COLUMN     "emailFromAddress" TEXT,
ADD COLUMN     "emailFromName" TEXT,
ADD COLUMN     "emailReplyTo" TEXT,
ADD COLUMN     "faviconUrl" TEXT,
ADD COLUMN     "helpCenterUrl" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "marketingSiteUrl" TEXT,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "secondaryColor" TEXT,
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "smsSenderId" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "statusPageUrl" TEXT,
ADD COLUMN     "supportWhatsapp" TEXT,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformRole" "LegacyPlatformRole";

-- CreateTable
CREATE TABLE "UserSchool" (
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSchool_pkey" PRIMARY KEY ("userId","schoolId")
);

-- CreateTable
CREATE TABLE "PlatformRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemKey" TEXT,
    "kind" "PlatformRoleKind" NOT NULL,
    "grantsAll" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,

    CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId","permissionKey")
);

-- CreateTable
CREATE TABLE "PlatformMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformMemberRole" (
    "memberId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "PlatformMemberRole_pkey" PRIMARY KEY ("memberId","roleId")
);

-- CreateTable
CREATE TABLE "PermissionDefinition" (
    "key" TEXT NOT NULL,
    "realm" "PermissionRealm" NOT NULL,
    "module" TEXT NOT NULL,
    "scopes" "PermissionScope"[],
    "personas" "Persona"[],
    "requiresFeature" TEXT,
    "introducedInVersion" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RoleTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "persona" "Persona" NOT NULL DEFAULT 'STAFF',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "grantsAll" BOOLEAN NOT NULL DEFAULT false,
    "autoProvision" BOOLEAN NOT NULL DEFAULT true,
    "defaultForPersona" "Persona",
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleTemplatePermission" (
    "templateId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "RoleTemplatePermission_pkey" PRIMARY KEY ("templateId","permissionKey")
);

-- CreateTable
CREATE TABLE "FeatureDefinition" (
    "key" TEXT NOT NULL,
    "origin" "DefinitionOrigin" NOT NULL DEFAULT 'CODE',
    "kind" "FeatureKind" NOT NULL,
    "module" TEXT NOT NULL,
    "meterKey" TEXT,
    "unit" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enforcement" "Enforcement" NOT NULL DEFAULT 'BLOCK',
    "upsellMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlanEntitlement" (
    "planId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "boolValue" BOOLEAN,
    "limitValue" INTEGER,
    "enumValue" TEXT,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("planId","featureKey")
);

-- CreateTable
CREATE TABLE "SchoolEntitlementOverride" (
    "schoolId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "boolValue" BOOLEAN,
    "limitValue" INTEGER,
    "enumValue" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolEntitlementOverride_pkey" PRIMARY KEY ("schoolId","featureKey")
);

-- CreateTable
CREATE TABLE "SettingDefinition" (
    "key" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "type" "SettingType" NOT NULL,
    "constraints" JSONB,
    "dependsOn" JSONB,
    "requiresFeature" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "group" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "defaultValue" JSONB NOT NULL,
    "isSchoolEditable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettingDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AutomationRuleDefinition" (
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "eventKey" TEXT,
    "anchor" TEXT,
    "paramsSchema" JSONB NOT NULL,
    "allowedChannels" "NotificationChannel"[],
    "allowedAudiences" TEXT[],
    "templateKey" TEXT NOT NULL,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "requiresFeature" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultParams" JSONB NOT NULL,
    "defaultChannels" "NotificationChannel"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRuleDefinition_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "category" "TemplateCategory" NOT NULL,
    "variables" JSONB NOT NULL,
    "isSchoolOverridable" BOOLEAN NOT NULL DEFAULT true,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSchool_schoolId_idx" ON "UserSchool"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRole_name_key" ON "PlatformRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRole_systemKey_key" ON "PlatformRole"("systemKey");

-- CreateIndex
CREATE INDEX "PlatformRolePermission_permissionKey_idx" ON "PlatformRolePermission"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMember_userId_key" ON "PlatformMember"("userId");

-- CreateIndex
CREATE INDEX "PlatformMemberRole_roleId_idx" ON "PlatformMemberRole"("roleId");

-- CreateIndex
CREATE INDEX "PermissionDefinition_realm_module_idx" ON "PermissionDefinition"("realm", "module");

-- CreateIndex
CREATE INDEX "PermissionDefinition_isDeprecated_idx" ON "PermissionDefinition"("isDeprecated");

-- CreateIndex
CREATE UNIQUE INDEX "RoleTemplate_key_key" ON "RoleTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RoleTemplate_defaultForPersona_key" ON "RoleTemplate"("defaultForPersona");

-- CreateIndex
CREATE INDEX "RoleTemplatePermission_permissionKey_idx" ON "RoleTemplatePermission"("permissionKey");

-- CreateIndex
CREATE INDEX "FeatureDefinition_module_isActive_idx" ON "FeatureDefinition"("module", "isActive");

-- CreateIndex
CREATE INDEX "FeatureDefinition_kind_idx" ON "FeatureDefinition"("kind");

-- CreateIndex
CREATE INDEX "FeatureDefinition_origin_idx" ON "FeatureDefinition"("origin");

-- CreateIndex
CREATE INDEX "PlanEntitlement_featureKey_idx" ON "PlanEntitlement"("featureKey");

-- CreateIndex
CREATE INDEX "SchoolEntitlementOverride_featureKey_idx" ON "SchoolEntitlementOverride"("featureKey");

-- CreateIndex
CREATE INDEX "SchoolEntitlementOverride_expiresAt_idx" ON "SchoolEntitlementOverride"("expiresAt");

-- CreateIndex
CREATE INDEX "SchoolEntitlementOverride_createdById_idx" ON "SchoolEntitlementOverride"("createdById");

-- CreateIndex
CREATE INDEX "SettingDefinition_area_isActive_idx" ON "SettingDefinition"("area", "isActive");

-- CreateIndex
CREATE INDEX "SettingDefinition_sortOrder_idx" ON "SettingDefinition"("sortOrder");

-- CreateIndex
CREATE INDEX "AutomationRuleDefinition_module_isActive_idx" ON "AutomationRuleDefinition"("module", "isActive");

-- CreateIndex
CREATE INDEX "AutomationRuleDefinition_trigger_idx" ON "AutomationRuleDefinition"("trigger");

-- CreateIndex
CREATE INDEX "MessageTemplate_category_isActive_idx" ON "MessageTemplate"("category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_channel_locale_key" ON "MessageTemplate"("key", "channel", "locale");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_action_idx" ON "AuditLog"("module", "action");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_actorMembershipId_idx" ON "AuditLog"("actorMembershipId");

-- CreateIndex
CREATE INDEX "BillingHistory_subscriptionId_createdAt_idx" ON "BillingHistory"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingHistory_status_idx" ON "BillingHistory"("status");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_schoolId_createdAt_idx" ON "Feedback"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Invite_schoolId_email_idx" ON "Invite"("schoolId", "email");

-- CreateIndex
CREATE INDEX "Invite_roleId_idx" ON "Invite"("roleId");

-- CreateIndex
CREATE INDEX "Invite_roleKey_idx" ON "Invite"("roleKey");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Otp_userId_type_idx" ON "Otp"("userId", "type");

-- CreateIndex
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformNotificationRecipient_idempotencyKey_key" ON "PlatformNotificationRecipient"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PlatformNotificationRecipient_status_nextRetryAt_idx" ON "PlatformNotificationRecipient"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "School_status_idx" ON "School"("status");

-- CreateIndex
CREATE INDEX "School_deletedAt_idx" ON "School"("deletedAt");

-- CreateIndex
CREATE INDEX "SchoolDocument_schoolId_idx" ON "SchoolDocument"("schoolId");

-- CreateIndex
CREATE INDEX "Subscription_schoolId_status_idx" ON "Subscription"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "PermissionDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMember" ADD CONSTRAINT "PlatformMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMemberRole" ADD CONSTRAINT "PlatformMemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PlatformMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformMemberRole" ADD CONSTRAINT "PlatformMemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTemplatePermission" ADD CONSTRAINT "RoleTemplatePermission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RoleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTemplatePermission" ADD CONSTRAINT "RoleTemplatePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "PermissionDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "FeatureDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEntitlementOverride" ADD CONSTRAINT "SchoolEntitlementOverride_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEntitlementOverride" ADD CONSTRAINT "SchoolEntitlementOverride_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "FeatureDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
