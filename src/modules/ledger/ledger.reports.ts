import { ledgerErrors } from "./ledger.errors";
import { parseDay } from "./ledger.posting";

/*
|--------------------------------------------------------------------------
| BOOK REPORTS (simple views; the accountant reports in phase 4 build on the same lines)
|
|   accountBalances(asOf)   every account with its debits, credits and balance up to a date
|   cashBook(account, from, to)   one money account: opening balance, each movement, running balance, closing balance
|
| Amounts are BigInt kobo. A balance is shown on the account's natural side: assets and expenses grow with
| debits, liabilities, equity and income grow with credits. Reversed journals stay in (the reversal cancels them
| out), so a report for a past date never changes unless something is posted into that date.
|--------------------------------------------------------------------------
*/

export type AccountTypeName = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
const DEBIT_NORMAL: ReadonlySet<string> = new Set(["ASSET", "EXPENSE"]);

/** Debit minus credit for assets and expenses; credit minus debit for the rest. */
export const naturalBalance = (type: string, debit: bigint, credit: bigint): bigint =>
    DEBIT_NORMAL.has(type) ? debit - credit : credit - debit;

export interface ReportDb {
    $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

export interface AccountBalanceRow {
    accountId: string; code: string; name: string; type: string; subtype: string; systemKey: string | null; isMoneyAccount: boolean;
    debitKobo: bigint; creditKobo: bigint; balanceKobo: bigint;
}

export interface CashBookLine {
    date: string; journalId: string; number: string; description: string; sourceType: string;
    inKobo: bigint; outKobo: bigint; balanceKobo: bigint;
}
export interface CashBook {
    account: { id: string; code: string; name: string; type: string };
    from: string; to: string;
    openingKobo: bigint; totalInKobo: bigint; totalOutKobo: bigint; closingKobo: bigint;
    lines: CashBookLine[];
}

interface RawMovement { date: string; journalId: string; number: string; description: string; sourceType: string; debitKobo: bigint; creditKobo: bigint }

/** Pure: opening balance plus ordered movements, in, out and a running balance. */
export function buildCashBook(
    account: CashBook["account"], from: string, to: string, openingDebit: bigint, openingCredit: bigint, movements: RawMovement[],
): CashBook {
    const opening = naturalBalance(account.type, openingDebit, openingCredit);
    let running = opening, totalIn = 0n, totalOut = 0n;
    const lines = movements.map(m => {
        const inKobo  = DEBIT_NORMAL.has(account.type) ? m.debitKobo : m.creditKobo;
        const outKobo = DEBIT_NORMAL.has(account.type) ? m.creditKobo : m.debitKobo;
        running += inKobo - outKobo; totalIn += inKobo; totalOut += outKobo;
        return { date: m.date, journalId: m.journalId, number: m.number, description: m.description, sourceType: m.sourceType, inKobo, outKobo, balanceKobo: running };
    });
    return { account, from, to, openingKobo: opening, totalInKobo: totalIn, totalOutKobo: totalOut, closingKobo: running, lines };
}

const big = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(v as string | number));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export class LedgerReportService {
    constructor(private readonly deps: { db: () => ReportDb }) {}

    async accountBalances(asOf: string, opts: { moneyOnly?: boolean } = {}): Promise<AccountBalanceRow[]> {
        parseDay(asOf);
        const rows = await this.deps.db().$queryRawUnsafe<any[]>(
            `SELECT a.id AS "accountId", a.code, a.name, a.type::text AS type, a.subtype, a."systemKey", a."isMoneyAccount",
                    COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l."debitKobo"  END), 0) AS debit,
                    COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l."creditKobo" END), 0) AS credit
               FROM "LedgerAccount" a
               LEFT JOIN "JournalLine" l  ON l."ledgerAccountId" = a.id
               LEFT JOIN "JournalEntry" e ON e.id = l."journalId" AND e."entryDate" <= $1::date
              WHERE a."deletedAt" IS NULL ${opts.moneyOnly ? 'AND a."isMoneyAccount" = true' : ""}
              GROUP BY a.id
              ORDER BY a.code`,
            asOf,
        );
        // A line whose journal is dated after `asOf` finds no entry in the join (e.id is null), so it is not counted
        return rows.map(r => ({ ...r, ...this.sum(r) }));
    }

    private sum(r: { type: string; debit: unknown; credit: unknown }) {
        const debitKobo = big(r.debit), creditKobo = big(r.credit);
        return { debitKobo, creditKobo, balanceKobo: naturalBalance(r.type, debitKobo, creditKobo) };
    }

    async cashBook(accountId: string, from: string, to: string): Promise<CashBook> {
        parseDay(from); parseDay(to);
        if (from > to) throw ledgerErrors.invalidJournal("The start date is after the end date");
        const db = this.deps.db();

        const [account] = await db.$queryRawUnsafe<any[]>(
            `SELECT id, code, name, type::text AS type, "isMoneyAccount" FROM "LedgerAccount" WHERE id = $1 AND "deletedAt" IS NULL`, accountId);
        if (!account) throw ledgerErrors.accountNotFound(accountId);
        if (!account.isMoneyAccount) throw ledgerErrors.notMoneyAccount(account.name);

        const [before] = await db.$queryRawUnsafe<any[]>(
            `SELECT COALESCE(SUM(l."debitKobo"), 0) AS debit, COALESCE(SUM(l."creditKobo"), 0) AS credit
               FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."journalId"
              WHERE l."ledgerAccountId" = $1 AND e."entryDate" < $2::date`, accountId, from);

        const moves = await db.$queryRawUnsafe<any[]>(
            `SELECT e."entryDate" AS date, e.id AS "journalId", e.number, e.description, e."sourceType"::text AS "sourceType",
                    l."debitKobo", l."creditKobo"
               FROM "JournalLine" l JOIN "JournalEntry" e ON e.id = l."journalId"
              WHERE l."ledgerAccountId" = $1 AND e."entryDate" BETWEEN $2::date AND $3::date
              ORDER BY e."entryDate", e."postedAt", e.number, l."lineNumber"`, accountId, from, to);

        return buildCashBook(
            { id: account.id, code: account.code, name: account.name, type: account.type }, from, to,
            big(before.debit), big(before.credit),
            moves.map(m => ({ ...m, date: day(m.date), debitKobo: big(m.debitKobo), creditKobo: big(m.creditKobo) })),
        );
    }
}
