/* Plain shapes the gateway settlements module passes around. Days are YYYY-MM-DD; money is whole kobo (bigint). */

/** A confirmed online payment, with whether a live settlement has already paid it out. */
export interface OnlinePaymentFacts {
    id: string; reference: string | null; gatewayReference: string | null; amountKobo: bigint;
    status: string; reversed: boolean; settled: boolean; paidAt: string | null; payerName: string | null;
}

export interface SettlementEntity {
    id: string; provider: string; reference: string; settledOn: string;
    grossKobo: bigint; feeKobo: bigint; netKobo: bigint; accountId: string; accountName: string | null;
    journalId: string; journalNumber: string | null; itemCount: number; note: string | null;
    recordedById: string | null; createdAt: Date;
    reversedAt: Date | null; reverseReason: string | null;
}

export interface SettlementItemEntity { paymentId: string; reference: string | null; payerName: string | null; amountKobo: bigint; feeKobo: bigint }

export interface NewSettlement {
    id: string; provider: string; reference: string; settledOn: string; grossKobo: bigint; feeKobo: bigint; netKobo: bigint;
    accountId: string; journalId: string; note: string | null; recordedById: string | null;
}
export interface NewSettlementItem { id: string; paymentId: string; amountKobo: bigint; feeKobo: bigint }
