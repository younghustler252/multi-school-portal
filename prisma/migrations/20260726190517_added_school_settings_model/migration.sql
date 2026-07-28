-- AlterTable
ALTER TABLE "School" ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "customDomainVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#1a1a2e',
    "secondaryColor" TEXT,
    "motto" TEXT,
    "address" TEXT,
    "website" TEXT,
    "foundedYear" INTEGER,
    "principalName" TEXT,
    "stamp" TEXT,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);
