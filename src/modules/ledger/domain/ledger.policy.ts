import type { LedgerAccountType } from "./ledger.entity";

/*
| LEDGER POLICY: rules about which accounts people may touch by hand.
*/

// Accounts with a sub-ledger (invoices, bills, payslips). Posting to them by hand would break the nightly control check.
export const CONTROL_SYSTEM_KEYS: ReadonlySet<string> = new Set([
    "FEES_RECEIVABLE", "ADVANCE_PAYMENTS", "STAFF_LOANS_RECEIVABLE",
    "ACCOUNTS_PAYABLE", "SALARIES_PAYABLE", "TAX_PAYABLE", "PENSION_PAYABLE",
]);

export const isControlAccount = (systemKey: string | null): boolean => systemKey !== null && CONTROL_SYSTEM_KEYS.has(systemKey);

/*
| ACCOUNT CODES: four digits, and the first digit says what kind of account it is (1 assets, 2 liabilities,
| 3 equity, 4 income, 5 expenses). A code is permanent once created.
*/
export const CODE_PREFIX: Record<LedgerAccountType, string> = { ASSET: "1", LIABILITY: "2", EQUITY: "3", INCOME: "4", EXPENSE: "5" };

/** Accounts people add themselves take 4xx0 style numbers below the "other" account at x900. */
export const AUTO_CODE_LIMIT = 900;

/** The next free code for a type: ten above the highest code in its range below x900. Null when the range is full. */
export function nextAccountCode(type: LedgerAccountType, usedCodes: string[]): string | null {
    const base = Number(CODE_PREFIX[type]) * 1000;
    const inRange = usedCodes.map(Number).filter(n => Number.isInteger(n) && n >= base && n < base + AUTO_CODE_LIMIT);
    const next = (inRange.length ? Math.max(...inRange) : base - 10) + 10;
    return next < base + AUTO_CODE_LIMIT ? String(next) : null;
}

/** Subtypes people may choose when adding an account. The others (receivable, payable, ...) belong to system accounts. */
export const USER_ACCOUNT_KINDS = ["GENERAL", "CASH", "BANK", "PETTY_CASH"] as const;
export type UserAccountKind = typeof USER_ACCOUNT_KINDS[number];
