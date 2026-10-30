import {
    AccountOverview, BankLineEntity, BankStatementEntity, BookLineEntity, MatchGroupEntity, MatchKind,
    NewBankLine, NewBankStatement, ReconciliationEntity,
} from "../domain/reconciliation.entity";

export type LineStatus = "unmatched" | "matched" | "all";

export interface BankLineFilter { accountId: string; status: LineStatus; from?: string; to?: string; statementId?: string; page: number; limit: number }
export interface BookLineFilter { accountId: string; status: LineStatus; from?: string; to?: string; page: number; limit: number }
export interface Page<T> { rows: T[]; total: number }

export interface IBankStatementRepository {
    /** Which of these keys already exist for the account (an overlapping upload). */
    existingDedupeKeys(accountId: string, keys: string[]): Promise<Set<string>>;
    findByFileHash(accountId: string, fileHash: string): Promise<BankStatementEntity | null>;
    /** Saves the statement and its lines together (call inside a transaction). */
    insert(statement: NewBankStatement, lines: NewBankLine[]): Promise<void>;
    findStatement(id: string): Promise<BankStatementEntity | null>;
    listStatements(accountId: string | null, page: number, limit: number): Promise<Page<BankStatementEntity>>;
    matchedLineCount(statementId: string): Promise<number>;
    deleteStatement(id: string): Promise<void>;
    listLines(f: BankLineFilter): Promise<Page<BankLineEntity>>;
    findLines(ids: string[]): Promise<BankLineEntity[]>;
    /** Unmatched lines dated on or before the day, oldest first. */
    unmatchedUpTo(accountId: string, toDay: string): Promise<BankLineEntity[]>;
    /** Running balances printed by the bank, oldest first, up to the day. */
    balancesUpTo(accountId: string, toDay: string): Promise<{ date: string; balanceKobo: bigint | null }[]>;
}

export interface IBookLineRepository {
    list(f: BookLineFilter): Promise<Page<BookLineEntity>>;
    findByIds(ids: string[]): Promise<BookLineEntity[]>;
    /** Unmatched journal lines of the account dated on or before the day, oldest first. Reversal pairs are NOT removed here. */
    unmatchedUpTo(accountId: string, toDay: string): Promise<BookLineEntity[]>;
    /** Ledger balance of the account (debits minus credits) on the day. */
    balanceAsOf(accountId: string, day: string): Promise<bigint>;
}

export interface IMatchRepository {
    /** Creates the group and claims the lines. False when any line was claimed by someone else first (nothing is saved). */
    createGroup(g: { id: string; ledgerAccountId: string; kind: MatchKind; note: string | null; createdById: string | null }, bankLineIds: string[], journalLineIds: string[]): Promise<boolean>;
    findGroup(id: string): Promise<MatchGroupEntity | null>;
    deleteGroup(id: string): Promise<void>;
}

export interface IReconciliationRepository {
    find(accountId: string, periodId: string): Promise<ReconciliationEntity | null>;
    findById(id: string): Promise<ReconciliationEntity | null>;
    create(r: { id: string; ledgerAccountId: string; periodId: string; statementBalanceKobo: bigint; bookBalanceKobo: bigint; outstandingBookKobo: bigint; note: string | null; completedById: string | null }): Promise<void>;
    delete(id: string): Promise<void>;
    list(accountId: string | null): Promise<ReconciliationEntity[]>;
    /** The latest month end this account has been signed off through, or null. Everything dated up to it is locked. */
    lockedThrough(accountId: string): Promise<string | null>;
    latest(accountId: string): Promise<ReconciliationEntity | null>;
    overview(): Promise<AccountOverview[]>;
}
