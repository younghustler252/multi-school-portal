/*
| LEDGER ENTITIES. The school's books as the rest of the code sees them.
| Money is BigInt kobo. Dates the books care about are Date values at UTC midnight (plain calendar days).
*/
export type LedgerAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type JournalStatus = "POSTED" | "REVERSED";
export type PeriodStatus  = "OPEN" | "CLOSED";
export type PartyType     = "STUDENT" | "GUARDIAN" | "VENDOR" | "STAFF";
export type JournalSource =
    | "FEE_INVOICE" | "PAYMENT" | "REFUND" | "ADJUSTMENT" | "EXPENSE_BILL" | "EXPENSE_PAYMENT"
    | "PAYROLL_ACCRUAL" | "PAYROLL_PAYMENT" | "PAYROLL_REMITTANCE" | "TRANSFER" | "OPENING_BALANCE" | "MANUAL" | "REVERSAL";

export interface LedgerAccountEntity {
    id:             string;
    code:           string;
    name:           string;
    type:           LedgerAccountType;
    subtype:        string;
    systemKey:      string | null;
    parentId:       string | null;
    isMoneyAccount: boolean;
    isActive:       boolean;
    isLocked:       boolean;
    sortOrder:      number;
    deletedAt:      Date | null;
}

export interface FinancePeriodEntity {
    id:           string;
    name:         string;
    startDate:    Date;
    endDate:      Date;
    status:       PeriodStatus;
    closedAt:     Date | null;
    reopenedAt:   Date | null;
    reopenReason: string | null;
}

export interface JournalLineEntity {
    id:            string;
    lineNumber:    number;
    accountId:     string;
    accountCode:   string | null;          // filled when the journal is read with its accounts
    accountName:   string | null;
    debitKobo:     bigint;
    creditKobo:    bigint;
    partyType:     PartyType | null;
    partyId:       string | null;
    memo:          string | null;
}

export interface JournalEntity {
    id:             string;
    number:         string;
    entryDate:      Date;
    periodId:       string;
    termId:         string | null;
    sessionId:      string | null;
    branchId:       string | null;
    description:    string;
    sourceType:     JournalSource;
    sourceId:       string | null;
    purpose:        string;
    idempotencyKey: string;
    status:         JournalStatus;
    reversalOfId:   string | null;
    reversalReason: string | null;
    totalKobo:      bigint;
    createdById:    string | null;
    isSystemActor:  boolean;
    postedAt:       Date;
    period:         { name: string; status: PeriodStatus } | null;   // filled when read with its period
    lines:          JournalLineEntity[];                             // filled when read with its lines
}

/** What the posting service hands to the repository to save (lines are saved with the journal, in one step). */
export interface NewJournal {
    id: string; number: string; entryDate: Date; periodId: string;
    termId: string | null; sessionId: string | null; branchId: string | null;
    description: string; sourceType: JournalSource; sourceId: string; purpose: string; idempotencyKey: string;
    reversalOfId?: string; reversalReason?: string;
    totalKobo: bigint; createdById: string | null; isSystemActor: boolean;
    lines: Array<{ lineNumber: number; ledgerAccountId: string; debitKobo: bigint; creditKobo: bigint; partyType: PartyType | null; partyId: string | null }>;
}

export interface JournalFilters {
    page?: number; limit?: number; from?: string; to?: string;
    sourceType?: string; status?: string; accountId?: string;
}
