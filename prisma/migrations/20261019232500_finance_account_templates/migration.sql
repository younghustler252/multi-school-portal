-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "LedgerAccountTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT 'GENERAL',
    "systemKey" TEXT,
    "parentCode" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccountTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccountTemplate_code_key" ON "LedgerAccountTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccountTemplate_systemKey_key" ON "LedgerAccountTemplate"("systemKey");

-- CreateIndex
CREATE INDEX "LedgerAccountTemplate_isActive_idx" ON "LedgerAccountTemplate"("isActive");
