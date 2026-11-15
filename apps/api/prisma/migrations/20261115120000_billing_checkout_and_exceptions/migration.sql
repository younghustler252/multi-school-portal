-- REM-066: one live checkout per invoice. checkoutKey is set (to the invoice id) only on checkout attempts created by the new code, so old
-- pending attempts (NULL) are untouched and cannot conflict; the index covers only attempts still pending, so it frees itself the moment
-- an attempt succeeds, fails or is abandoned. REM-070: a first-class record for captured money that could not be applied.
ALTER TABLE "PaymentAttempt" ADD COLUMN "authorizationUrl" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN "checkoutKey" TEXT;
CREATE UNIQUE INDEX "PaymentAttempt_one_pending_checkout" ON "PaymentAttempt"("checkoutKey") WHERE "status" = 'pending' AND "checkoutKey" IS NOT NULL;

CREATE TYPE "CapturedPaymentExceptionKind" AS ENUM ('paid_on_void', 'duplicate_payment', 'amount_mismatch', 'superseded');
CREATE TYPE "CapturedPaymentExceptionStatus" AS ENUM ('open', 'refunded', 'applied_manually', 'dismissed');

CREATE TABLE "CapturedPaymentException" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "CapturedPaymentExceptionKind" NOT NULL,
    "reference" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "detail" JSONB,
    "status" "CapturedPaymentExceptionStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapturedPaymentException_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CapturedPaymentException_attemptId_key" ON "CapturedPaymentException"("attemptId");
CREATE INDEX "CapturedPaymentException_status_createdAt_idx" ON "CapturedPaymentException"("status", "createdAt");
CREATE INDEX "CapturedPaymentException_schoolId_idx" ON "CapturedPaymentException"("schoolId");
