import { REQUIRED_SYSTEM_KEYS } from "./ledger.constants";

/*
|--------------------------------------------------------------------------
| LEDGER INTEGRITY (brief section 14): the nightly proof that the books are sound.
| The database refuses bad data and the posting service refuses it first, so on a healthy school this finds
| nothing. It exists to prove that, and to shout the moment someone (a script, a manual SQL fix, a future bug)
| breaks a rule. Every check is read-only. Later phases add their control checks (receivables against invoices,
| payables against bills, advance payments against allocations: the first two now run, see feesControls) to the same list.
|--------------------------------------------------------------------------
*/

export type IntegrityCheck =
    | "UNBALANCED_JOURNAL"          // a journal with fewer than two lines, unequal sides, or a wrong total
    | "TRIAL_BALANCE"               // all debits in the school do not equal all credits
    | "REVERSAL_MISSING"            // a REVERSED journal that no reversal points to
    | "REVERSAL_ORIGINAL_NOT_MARKED" // a reversal whose original is not marked REVERSED
    | "REVERSAL_NOT_MIRROR"         // a reversal whose lines are not the exact opposite of the original's
    | "PERIOD_MISMATCH"             // a journal dated outside the month it was filed in
    | "FUTURE_DATED"                // a journal dated after the day it was posted
    | "POSTED_AFTER_CLOSE"          // posted into a period after it was closed
    | "DUPLICATE_OPENING_BALANCE"   // two live opening balances for one account
    | "LINE_ON_DELETED_ACCOUNT"     // a line on an account that was deleted
    | "RECEIVABLE_CONTROL"          // fees receivable in the books is not what the issued invoices still owe (school total, or one student)
    | "ADVANCE_CONTROL"             // advance payments in the books is not the unallocated money on confirmed payments
    | "INVOICE_PAID_MISMATCH"       // an invoice shows paid money that its live payment allocations do not add up to
    | "CREDIT_MISMATCH"             // a confirmed payment's unallocated amount is not what its credit rows add up to
    | "PAYABLE_CONTROL"             // accounts payable in the books is not what approved bills still owe (school total, or one supplier)
    | "EXPENSE_PAID_MISMATCH"        // an expense shows paid money that its payments (not reversed) do not add up to
    | "PAYROLL_CONTROL"             // salaries payable in the books is not what approved, unpaid payslips still owe (school total, or one staff member)
    | "LOAN_CONTROL"                // staff loans receivable in the books is not what active loans still owe (school total, or one staff member)
    | "SYSTEM_ACCOUNT";             // a system account is missing, inactive, deleted or unlocked

export interface IntegrityFinding {
    check:   IntegrityCheck;
    message: string;
    details: Record<string, unknown>;
}

export interface IntegrityReport {
    checkedAt: string;
    ok:        boolean;
    findings:  IntegrityFinding[];
    byCheck:   Partial<Record<IntegrityCheck, number>>;
}

export const MAX_ROWS_PER_CHECK = 50;     // a broken school could have thousands; the first 50 are enough to start

export function buildReport(findings: IntegrityFinding[], now: Date): IntegrityReport {
    const byCheck: Partial<Record<IntegrityCheck, number>> = {};
    for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
    return { checkedAt: now.toISOString(), ok: findings.length === 0, findings, byCheck };
}

export interface SystemAccountRow { systemKey: string | null; isActive: boolean; isLocked: boolean; deletedAt: Date | null }

/** Pure: compares the school's accounts with the 17 system accounts the posting rules need. */
export function systemAccountFindings(accounts: SystemAccountRow[]): IntegrityFinding[] {
    const bySystemKey = new Map(accounts.filter(a => a.systemKey).map(a => [a.systemKey as string, a]));
    const findings: IntegrityFinding[] = [];
    for (const key of REQUIRED_SYSTEM_KEYS) {
        const a = bySystemKey.get(key);
        const problem = !a ? "is missing" : a.deletedAt ? "was deleted" : !a.isActive ? "is inactive" : !a.isLocked ? "is not locked" : null;
        if (problem) findings.push({ check: "SYSTEM_ACCOUNT", message: `System account ${key} ${problem}`, details: { systemKey: key, problem } });
    }
    return findings;
}
