-- REM-102: one active processor per webhook event. A processor holds a lease (token + expiry); a second delivery of the same
-- event cannot start while the lease is live, and a crashed processor's event becomes reclaimable once the lease expires.
ALTER TYPE "WebhookEventStatus" ADD VALUE IF NOT EXISTS 'processing' AFTER 'received';

ALTER TABLE "WebhookEvent" ADD COLUMN "claimToken" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "claimExpiresAt" TIMESTAMP(3);
