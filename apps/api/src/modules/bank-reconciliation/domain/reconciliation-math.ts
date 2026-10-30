/*
|--------------------------------------------------------------------------
| THE RECONCILIATION STATEMENT: does the bank agree with the books? Pure arithmetic over signed kobo
| (money in positive, money out negative).
|
|   statement balance        what the bank says the account holds at the end of the month
|   + outstanding book items  entries the books have that the bank has not shown yet (a cheque not cashed, a deposit in transit)
|   = adjusted bank balance
|
|   book balance             what the ledger says the account holds at the end of the month
|   + bank items not in books  lines on the statement the books do not have yet (charges, interest)
|   = adjusted book balance
|
| The two adjusted balances must be equal. A month is only completed when they are AND every bank line up to month end is
| matched or recorded, so the books never carry something the bank has already settled differently.
|--------------------------------------------------------------------------
*/

export interface SummaryInput {
    statementBalanceKobo: bigint;
    bookBalanceKobo:      bigint;
    outstandingBookKobo:  bigint;   // net of book lines up to month end that no bank line accounts for
    unmatchedBankKobo:    bigint;   // net of bank lines up to month end that no book line accounts for
    unmatchedBankCount:   number;
}

export interface ReconciliationSummary extends SummaryInput {
    adjustedBankKobo: bigint;
    adjustedBookKobo: bigint;
    differenceKobo:   bigint;       // adjusted bank minus adjusted book; zero when the account agrees
    canComplete:      boolean;
}

export function summarise(i: SummaryInput): ReconciliationSummary {
    const adjustedBankKobo = i.statementBalanceKobo + i.outstandingBookKobo;
    const adjustedBookKobo = i.bookBalanceKobo + i.unmatchedBankKobo;
    const differenceKobo = adjustedBankKobo - adjustedBookKobo;
    return { ...i, adjustedBankKobo, adjustedBookKobo, differenceKobo, canComplete: differenceKobo === 0n && i.unmatchedBankCount === 0 };
}

/* The sign of a journal line on a money account: debits add money, credits take it away. */
export const bookAmount = (debitKobo: bigint, creditKobo: bigint): bigint => debitKobo - creditKobo;

/*
| The balance the bank states at the end of a month, when the person did not type one in: the running balance on the last
| line dated on or before the month end. Lines arrive oldest first; null when no such line carries a balance.
*/
export function statementBalanceAt(lines: { date: string; balanceKobo: bigint | null }[], asOf: string): bigint | null {
    let found: bigint | null = null;
    for (const l of lines) if (l.date <= asOf && l.balanceKobo !== null) found = l.balanceKobo;
    return found;
}
