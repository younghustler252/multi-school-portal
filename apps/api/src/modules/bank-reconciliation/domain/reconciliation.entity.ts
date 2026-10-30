/* Plain shapes the bank reconciliation module passes around. Days are YYYY-MM-DD strings; money is signed BigInt kobo (in +, out -). */

export type MatchKind = "AUTO" | "MANUAL" | "CREATED" | "CLEARED";

export interface BankStatementEntity {
    id: string; ledgerAccountId: string; fileName: string | null;
    startDate: string; endDate: string;
    openingBalanceKobo: bigint | null; closingBalanceKobo: bigint | null;
    lineCount: number; importedById: string | null; importedAt: Date;
}

export interface BankLineEntity {
    id: string; statementId: string; ledgerAccountId: string; lineNumber: number;
    date: string; description: string; reference: string | null;
    amountKobo: bigint; balanceKobo: bigint | null; matchGroupId: string | null;
}

/** One side of a journal that touched the bank account, signed the same way as a bank line (debit +, credit -). */
export interface BookLineEntity {
    id: string; ledgerAccountId: string;
    journalId: string; journalNumber: string; lineNumber: number;
    date: string; description: string; memo: string | null; sourceType: string; journalStatus: string;
    reversalOfJournalId: string | null;
    amountKobo: bigint; matchGroupId: string | null;
}

export interface MatchGroupEntity {
    id: string; ledgerAccountId: string; kind: MatchKind; note: string | null;
    createdById: string | null; createdAt: Date; bankLineIds: string[]; journalLineIds: string[];
}

export interface ReconciliationEntity {
    id: string; ledgerAccountId: string; periodId: string; periodName: string; periodEnd: string;
    statementBalanceKobo: bigint; bookBalanceKobo: bigint; outstandingBookKobo: bigint;
    note: string | null; completedById: string | null; completedAt: Date;
}

export interface NewBankStatement {
    id: string; ledgerAccountId: string; fileName: string | null; fileHash: string;
    startDate: string; endDate: string; openingBalanceKobo: bigint | null; closingBalanceKobo: bigint | null;
    lineCount: number; importedById: string | null;
}
export interface NewBankLine {
    id: string; lineNumber: number; date: string; description: string; reference: string | null;
    amountKobo: bigint; balanceKobo: bigint | null; dedupeKey: string;
}

export interface AccountOverview {
    accountId: string; code: string; name: string; subtype: string;
    bankName: string | null; accountNumberLast4: string | null;
    statementLines: number; unmatchedBankLines: number; lastLineDate: string | null;
    reconciledThrough: string | null;
}
