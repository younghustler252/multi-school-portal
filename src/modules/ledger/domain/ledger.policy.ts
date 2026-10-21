/*
| LEDGER POLICY: rules about which accounts people may touch by hand.
*/

// Accounts with a sub-ledger (invoices, bills, payslips). Posting to them by hand would break the nightly control check.
export const CONTROL_SYSTEM_KEYS: ReadonlySet<string> = new Set([
    "FEES_RECEIVABLE", "ADVANCE_PAYMENTS", "STAFF_LOANS_RECEIVABLE",
    "ACCOUNTS_PAYABLE", "SALARIES_PAYABLE", "TAX_PAYABLE", "PENSION_PAYABLE",
]);

export const isControlAccount = (systemKey: string | null): boolean => systemKey !== null && CONTROL_SYSTEM_KEYS.has(systemKey);
