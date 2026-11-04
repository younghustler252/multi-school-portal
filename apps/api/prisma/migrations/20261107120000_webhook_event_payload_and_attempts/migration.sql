-- The webhook log keeps the few fields a handler needs (no customer, card or bank details) so a failed event can be retried
-- from the platform console, and counts the attempts.
ALTER TABLE "WebhookEvent"
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "payload" JSONB,
    ADD COLUMN "lastAttemptAt" TIMESTAMP(3);
