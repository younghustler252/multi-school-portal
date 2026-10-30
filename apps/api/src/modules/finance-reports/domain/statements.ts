import { AccountBalanceRow, naturalBalance } from "../../ledger/domain/cash-book";

/*
|--------------------------------------------------------------------------
| THE ACCOUNTANT'S STATEMENTS (brief 9.2). Pure maths over account totals; the queries are in the statement repository.
|
|   trial balance     every account's net position on the debit or the credit side, and proof that the two sides agree
|   income statement  income less expenses over a period, by account (accrual: when it was earned or owed, not when paid)
|   balance sheet     assets against liabilities and equity on a day. No year-end closing entries exist, so the surplus
|                     earned to date is shown as its own equity line; that is what makes the equation hold
|   cash flow         the money accounts' opening balance, what came in and went out by kind of event, the closing balance
|   general ledger    every account's movements with a running balance
| Amounts are BigInt kobo. Reversed journals stay in (their reversals cancel them), so a report for a past date never changes.
|--------------------------------------------------------------------------
*/

export const addDaysTo = (day: string, days: number): string => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

/* ---------- trial balance ---------- */
export interface TrialBalanceLine { accountId: string; code: string; name: string; type: string; debitKobo: bigint; creditKobo: bigint }
export interface TrialBalance { asOf: string; lines: TrialBalanceLine[]; totalDebitKobo: bigint; totalCreditKobo: bigint; balanced: boolean }

export function buildTrialBalance(rows: AccountBalanceRow[], asOf: string, hideZero = true): TrialBalance {
    const lines: TrialBalanceLine[] = [];
    for (const r of rows) {
        const net = r.debitKobo - r.creditKobo;
        if (hideZero && net === 0n) continue;
        lines.push({ accountId: r.accountId, code: r.code, name: r.name, type: r.type, debitKobo: net > 0n ? net : 0n, creditKobo: net < 0n ? -net : 0n });
    }
    lines.sort((a, b) => a.code.localeCompare(b.code));
    const totalDebitKobo = lines.reduce((s, l) => s + l.debitKobo, 0n);
    const totalCreditKobo = lines.reduce((s, l) => s + l.creditKobo, 0n);
    return { asOf, lines, totalDebitKobo, totalCreditKobo, balanced: totalDebitKobo === totalCreditKobo };
}

/* ---------- income statement ---------- */
export interface StatementLine { accountId: string; code: string; name: string; amountKobo: bigint }
export interface IncomeStatement {
    from: string; to: string; income: StatementLine[]; expenses: StatementLine[];
    totalIncomeKobo: bigint; totalExpensesKobo: bigint; surplusKobo: bigint;
}

const lineOf = (r: AccountBalanceRow): StatementLine => ({ accountId: r.accountId, code: r.code, name: r.name, amountKobo: r.balanceKobo });
const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);

/** `activity` is each account's debits and credits INSIDE the period (not a running balance). */
export function buildIncomeStatement(activity: AccountBalanceRow[], from: string, to: string): IncomeStatement {
    const income = activity.filter(r => r.type === "INCOME" && r.balanceKobo !== 0n).map(lineOf).sort(byCode);
    const expenses = activity.filter(r => r.type === "EXPENSE" && r.balanceKobo !== 0n).map(lineOf).sort(byCode);
    const totalIncomeKobo = income.reduce((s, l) => s + l.amountKobo, 0n);
    const totalExpensesKobo = expenses.reduce((s, l) => s + l.amountKobo, 0n);
    return { from, to, income, expenses, totalIncomeKobo, totalExpensesKobo, surplusKobo: totalIncomeKobo - totalExpensesKobo };
}

/* ---------- balance sheet ---------- */
export interface BalanceSheet {
    asOf: string; assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[];
    surplusToDateKobo: bigint; totalAssetsKobo: bigint; totalLiabilitiesKobo: bigint; totalEquityKobo: bigint;
    totalLiabilitiesAndEquityKobo: bigint; balanced: boolean; differenceKobo: bigint;
}

/** `balances` is every account's balance up to the day (running totals since the first posting). */
export function buildBalanceSheet(balances: AccountBalanceRow[], asOf: string): BalanceSheet {
    const section = (type: string) => balances.filter(r => r.type === type && r.balanceKobo !== 0n).map(lineOf).sort(byCode);
    const assets = section("ASSET"), liabilities = section("LIABILITY"), equity = section("EQUITY");
    const sum = (ls: StatementLine[]) => ls.reduce((s, l) => s + l.amountKobo, 0n);
    const incomeToDate = balances.filter(r => r.type === "INCOME").reduce((s, r) => s + r.balanceKobo, 0n);
    const expenseToDate = balances.filter(r => r.type === "EXPENSE").reduce((s, r) => s + r.balanceKobo, 0n);
    const surplusToDateKobo = incomeToDate - expenseToDate;
    const totalAssetsKobo = sum(assets), totalLiabilitiesKobo = sum(liabilities);
    const totalEquityKobo = sum(equity) + surplusToDateKobo;
    const totalLiabilitiesAndEquityKobo = totalLiabilitiesKobo + totalEquityKobo;
    const differenceKobo = totalAssetsKobo - totalLiabilitiesAndEquityKobo;
    return {
        asOf, assets, liabilities, equity, surplusToDateKobo, totalAssetsKobo, totalLiabilitiesKobo, totalEquityKobo,
        totalLiabilitiesAndEquityKobo, balanced: differenceKobo === 0n, differenceKobo,
    };
}

/* ---------- cash flow ---------- */
export const SOURCE_LABELS: Record<string, string> = {
    FEE_INVOICE: "Fee invoices", PAYMENT: "Fees received", REFUND: "Refunds paid", ADJUSTMENT: "Fee adjustments",
    EXPENSE_BILL: "Bills recorded", EXPENSE_PAYMENT: "Expenses and bills paid", PAYROLL_ACCRUAL: "Payroll accrued", PAYROLL_PAYMENT: "Salaries paid",
    PAYROLL_REMITTANCE: "Tax and pension remitted", TRANSFER: "Transfers between money accounts", OPENING_BALANCE: "Opening balances",
    MANUAL: "Manual journals", REVERSAL: "Reversals and corrections",
};
export interface MoneyBySource { sourceType: string; debitKobo: bigint; creditKobo: bigint }
export interface CashFlowLine { sourceType: string; label: string; inKobo: bigint; outKobo: bigint; netKobo: bigint }
export interface CashFlow {
    from: string; to: string; openingKobo: bigint; closingKobo: bigint; lines: CashFlowLine[];
    totalInKobo: bigint; totalOutKobo: bigint; netChangeKobo: bigint; reconciles: boolean;
}

/** Money in is a debit on a money account, money out a credit. Opening plus the net movement must equal the closing balance. */
export function buildCashFlow(openingKobo: bigint, closingKobo: bigint, moves: MoneyBySource[], from: string, to: string): CashFlow {
    const lines = moves
        .map(m => ({ sourceType: m.sourceType, label: SOURCE_LABELS[m.sourceType] ?? m.sourceType, inKobo: m.debitKobo, outKobo: m.creditKobo, netKobo: m.debitKobo - m.creditKobo }))
        .filter(l => l.inKobo !== 0n || l.outKobo !== 0n)
        .sort((a, b) => a.label.localeCompare(b.label));
    const totalInKobo = lines.reduce((s, l) => s + l.inKobo, 0n);
    const totalOutKobo = lines.reduce((s, l) => s + l.outKobo, 0n);
    const netChangeKobo = totalInKobo - totalOutKobo;
    return { from, to, openingKobo, closingKobo, lines, totalInKobo, totalOutKobo, netChangeKobo, reconciles: openingKobo + netChangeKobo === closingKobo };
}

/* ---------- general ledger ---------- */
export interface LedgerMovement {
    accountId: string; date: string; journalId: string; number: string; description: string; sourceType: string; debitKobo: bigint; creditKobo: bigint;
}
export interface GeneralLedgerSection {
    account: { id: string; code: string; name: string; type: string };
    openingKobo: bigint; closingKobo: bigint; totalDebitKobo: bigint; totalCreditKobo: bigint;
    lines: (LedgerMovement & { balanceKobo: bigint })[];
}
export interface GeneralLedger { from: string; to: string; sections: GeneralLedgerSection[] }

/** `opening` is each account's totals up to the day before `from`. Accounts with no opening balance and no movement are left out. */
export function buildGeneralLedger(opening: AccountBalanceRow[], moves: LedgerMovement[], from: string, to: string): GeneralLedger {
    const byAccount = new Map<string, LedgerMovement[]>();
    for (const m of moves) byAccount.set(m.accountId, [...(byAccount.get(m.accountId) ?? []), m]);
    const sections: GeneralLedgerSection[] = [];
    for (const a of [...opening].sort(byCode)) {
        const own = byAccount.get(a.accountId) ?? [];
        const openingKobo = naturalBalance(a.type, a.debitKobo, a.creditKobo);
        if (own.length === 0 && openingKobo === 0n) continue;
        let running = openingKobo, totalDebitKobo = 0n, totalCreditKobo = 0n;
        const lines = own.map(m => {
            running += naturalBalance(a.type, m.debitKobo, m.creditKobo);
            totalDebitKobo += m.debitKobo; totalCreditKobo += m.creditKobo;
            return { ...m, balanceKobo: running };
        });
        sections.push({ account: { id: a.accountId, code: a.code, name: a.name, type: a.type }, openingKobo, closingKobo: running, totalDebitKobo, totalCreditKobo, lines });
    }
    return { from, to, sections };
}
