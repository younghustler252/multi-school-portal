/*
  Warnings:

  - A unique constraint covering the columns `[systemKey]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `familyId` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "personaEntityId" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "systemKey" TEXT,
ALTER COLUMN "studentLimit" SET DEFAULT 0,
ALTER COLUMN "staffLimit" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT NOT NULL,
ADD COLUMN     "impersonatorId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "membershipId" TEXT,
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Plan_systemKey_key" ON "Plan"("systemKey");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
