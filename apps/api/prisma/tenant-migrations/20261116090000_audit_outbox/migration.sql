-- REM-077: audit events written inside a school's database transaction are saved in THIS table, in the same
-- transaction as the change they describe, so the two commit or roll back together. A background relay then copies
-- each event to the public AuditLog (using this row's id as the AuditLog id, so a retry never duplicates) and
-- deletes it. Rows here are therefore only events that are waiting for delivery.

-- CreateTable
CREATE TABLE "AuditOutbox" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimToken" TEXT,
    "claimExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditOutbox_createdAt_idx" ON "AuditOutbox"("createdAt");
