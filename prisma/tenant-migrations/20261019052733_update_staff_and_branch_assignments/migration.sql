/*
  Warnings:

  - You are about to drop the `MembershipBranch` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `firstName` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'volunteer');

-- DropForeignKey
ALTER TABLE "MembershipBranch" DROP CONSTRAINT "MembershipBranch_branchId_fkey";

-- DropForeignKey
ALTER TABLE "MembershipBranch" DROP CONSTRAINT "MembershipBranch_membershipId_fkey";

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'full_time',
ADD COLUMN     "exitDate" TIMESTAMP(3),
ADD COLUMN     "exitReason" TEXT,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'other';

-- DropTable
DROP TABLE "MembershipBranch";

-- CreateTable
CREATE TABLE "StaffBranch" (
    "staffId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "StaffBranch_pkey" PRIMARY KEY ("staffId","branchId")
);

-- CreateIndex
CREATE INDEX "StaffBranch_branchId_idx" ON "StaffBranch"("branchId");

-- CreateIndex
CREATE INDEX "Staff_isActive_idx" ON "Staff"("isActive");

-- CreateIndex
CREATE INDEX "Staff_category_idx" ON "Staff"("category");

-- CreateIndex
CREATE INDEX "Staff_email_idx" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_deletedAt_idx" ON "Staff"("deletedAt");

-- AddForeignKey
ALTER TABLE "StaffBranch" ADD CONSTRAINT "StaffBranch_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBranch" ADD CONSTRAINT "StaffBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
