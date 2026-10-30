-- Finance phase 6: gateway (Paystack) settlements matched to online payments. Amounts are whole kobo.

CREATE TABLE "GatewaySettlement" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "reference" TEXT NOT NULL,
    "settledOn" DATE NOT NULL,
    "grossKobo" BIGINT NOT NULL,
    "feeKobo" BIGINT NOT NULL,
    "netKobo" BIGINT NOT NULL,
    "accountId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    CONSTRAINT "GatewaySettlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GatewaySettlement_amounts_check" CHECK ("grossKobo" > 0 AND "feeKobo" >= 0 AND "feeKobo" < "grossKobo" AND "netKobo" = "grossKobo" - "feeKobo"),
    CONSTRAINT "GatewaySettlement_itemCount_check" CHECK ("itemCount" >= 0)
);

CREATE TABLE "GatewaySettlementItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountKobo" BIGINT NOT NULL,
    "feeKobo" BIGINT NOT NULL,
    CONSTRAINT "GatewaySettlementItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GatewaySettlementItem_amounts_check" CHECK ("amountKobo" > 0 AND "feeKobo" >= 0)
);

CREATE UNIQUE INDEX "GatewaySettlement_provider_reference_key" ON "GatewaySettlement"("provider", "reference");
CREATE UNIQUE INDEX "GatewaySettlement_journalId_key" ON "GatewaySettlement"("journalId");
CREATE INDEX "GatewaySettlement_settledOn_idx" ON "GatewaySettlement"("settledOn");
CREATE UNIQUE INDEX "GatewaySettlementItem_paymentId_key" ON "GatewaySettlementItem"("paymentId");
CREATE INDEX "GatewaySettlementItem_settlementId_idx" ON "GatewaySettlementItem"("settlementId");

ALTER TABLE "GatewaySettlement" ADD CONSTRAINT "GatewaySettlement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GatewaySettlement" ADD CONSTRAINT "GatewaySettlement_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GatewaySettlementItem" ADD CONSTRAINT "GatewaySettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "GatewaySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatewaySettlementItem" ADD CONSTRAINT "GatewaySettlementItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
