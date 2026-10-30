-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('open', 'paid', 'void', 'uncollectible');

-- CreateEnum
CREATE TYPE "BillingInvoiceReason" AS ENUM ('upgrade', 'renewal', 'adjustment');

-- CreateEnum
CREATE TYPE "BillingItemKind" AS ENUM ('plan', 'setup_fee', 'proration_credit', 'discount', 'adjustment');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('pending', 'success', 'failed', 'abandoned');

-- CreateEnum
CREATE TYPE "PaymentAttemptMethod" AS ENUM ('checkout', 'saved_card', 'manual');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('received', 'processed', 'ignored', 'failed');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingAnchorDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lapsedPlanId" TEXT,
ADD COLUMN     "paymentMethodId" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "subscriptionId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "reason" "BillingInvoiceReason" NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'open',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "subtotalKobo" INTEGER NOT NULL,
    "discountKobo" INTEGER NOT NULL DEFAULT 0,
    "totalKobo" INTEGER NOT NULL,
    "amountPaidKobo" INTEGER NOT NULL DEFAULT 0,
    "couponId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastFailureReason" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "BillingItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'pending',
    "method" "PaymentAttemptMethod" NOT NULL,
    "paymentMethodId" TEXT,
    "providerStatus" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "authorizationCode" TEXT NOT NULL,
    "signature" TEXT,
    "brand" TEXT,
    "last4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "bank" TEXT,
    "checkoutEmail" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "reference" TEXT,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'received',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingNotice" (
    "subscriptionId" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingNotice_pkey" PRIMARY KEY ("subscriptionId","periodEnd","key")
);

-- CreateTable
CREATE TABLE "PlatformSequence" (
    "key" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT '',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSequence_pkey" PRIMARY KEY ("key","period")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_number_key" ON "SubscriptionInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInvoice_idempotencyKey_key" ON "SubscriptionInvoice"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_schoolId_createdAt_idx" ON "SubscriptionInvoice"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_subscriptionId_status_idx" ON "SubscriptionInvoice"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_dueDate_idx" ON "SubscriptionInvoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_status_nextAttemptAt_idx" ON "SubscriptionInvoice"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SubscriptionInvoiceItem_invoiceId_idx" ON "SubscriptionInvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_invoiceId_idx" ON "PaymentAttempt"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentMethod_schoolId_removedAt_idx" ON "PaymentMethod"("schoolId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_schoolId_signature_key" ON "PaymentMethod"("schoolId", "signature");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventKey_key" ON "WebhookEvent"("provider", "eventKey");

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoiceItem" ADD CONSTRAINT "SubscriptionInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
