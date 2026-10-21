/*
|--------------------------------------------------------------------------
| BOOK REPORTS (simple views; the accountant reports in phase 4 build on the same lines)
|
|   account balances  every account with its debits, credits and balance up to a date
|   cash book         one money account: opening balance, each movement, running balance, closing balance
| (This file is the maths; the queries are in the report repository, the flow in the report use cases.)
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

export interface RawMovement { date: string; journalId: string; number: string; description: string; sourceType: string; debitKobo: bigint; creditKobo: bigint }

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
