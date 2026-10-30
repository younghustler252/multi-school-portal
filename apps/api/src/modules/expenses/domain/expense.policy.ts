import { ExpenseEntity, ExpenseStatus, RecurrenceFrequency } from "./expense.entity";
import { expenseErrors } from "./expense.errors";
import type { PostLine } from "../../ledger/services/posting.service";

/*
| EXPENSE RULES (brief sections 7 and 8.8) in plain functions: no database, no clock.
|
| These constants are the DEFAULTS. A school's own values come from the finance settings service (finance-settings module),
| which the use cases ask first; each constant names the setting that overrides it.
*/
export const EXPENSE_APPROVAL_REQUIRED = true;                 // finance.expense_approval_required
export const EXPENSE_APPROVAL_THRESHOLD_KOBO = 5_000_000n;     // finance.expense_approval_threshold_kobo (N50,000)
export const ALLOW_SELF_APPROVAL = false;                      // finance.allow_self_approval
export type BudgetEnforcement = "off" | "warn" | "block";
export const BUDGET_ENFORCEMENT: BudgetEnforcement = "warn";   // finance.budget_enforcement
export const EXPENSE_PREFIX = "EXP";                           // finance.expense_prefix
export const MONTHS_PER_TERM = 4;                              // a term is treated as four months until school terms drive recurrence
export const MAX_CATCH_UP_RUNS = 12;                           // a recurring expense that was off for a long time makes at most this many at once

/* Under the threshold (or with approval switched off) an expense approves itself when it is submitted. */
export const needsApproval = (
    totalKobo: bigint,
    rule: { required?: boolean; thresholdKobo?: bigint } = {},
): boolean => (rule.required ?? EXPENSE_APPROVAL_REQUIRED) && totalKobo >= (rule.thresholdKobo ?? EXPENSE_APPROVAL_THRESHOLD_KOBO);

export const expenseNumber = (year: string, n: number): string => `${EXPENSE_PREFIX}-${year}-${String(n).padStart(6, "0")}`;

/** What the expense costs in all: every line's amount plus its VAT. */
export const totalOf = (lines: { amountKobo: bigint; vatKobo?: bigint }[]): bigint => lines.reduce((s, l) => s + l.amountKobo + (l.vatKobo ?? 0n), 0n);

/** VAT on an amount at a rate in basis points (750 = 7.5%), rounded to the nearest kobo (halves up). */
export const vatOn = (amountKobo: bigint, rateBps: number): bigint => (amountKobo * BigInt(rateBps) + 5_000n) / 10_000n;

/** The input VAT on an expense, as one extra debit line (none when there is no VAT). */
const vatLine = (lines: { vatKobo?: bigint }[]): PostLine[] => {
    const vat = lines.reduce((s, l) => s + (l.vatKobo ?? 0n), 0n);
    return vat > 0n ? [{ systemKey: "VAT_RECEIVABLE" as const, debitKobo: vat }] : [];
};

/* Where a bill stands after money is paid or a payment is reversed. */
export function statusAfterPayment(totalKobo: bigint, paidKobo: bigint): ExpenseStatus {
    if (paidKobo <= 0n) return "APPROVED";
    return paidKobo >= totalKobo ? "PAID" : "PARTIALLY_PAID";
}

/* Only expense accounts can take an expense. Money accounts, assets, income and so on are refused, as are inactive accounts. */
export interface AccountFacts { id: string; name: string; type: string; isActive: boolean; isMoneyAccount: boolean }
export function checkExpenseAccounts(wanted: string[], found: AccountFacts[]): void {
    const byId = new Map(found.map(a => [a.id, a]));
    for (const id of new Set(wanted)) {
        const a = byId.get(id);
        if (!a) throw expenseErrors.expenseAccountInvalid("That account does not exist", id);
        if (!a.isActive) throw expenseErrors.expenseAccountInvalid(`${a.name} is not active`, id);
        if (a.type !== "EXPENSE" || a.isMoneyAccount) throw expenseErrors.expenseAccountInvalid(`${a.name} is not an expense account`, id);
    }
}

/* DIRECT or BILL accrual lines. Each fee line is its own debit; the credit is one line for the whole expense. */
export function accrualLines(e: Pick<ExpenseEntity, "lines" | "totalKobo" | "vendorId">): PostLine[] {
    return [
        ...e.lines.map(l => ({ accountId: l.ledgerAccountId, debitKobo: l.amountKobo })),
        ...vatLine(e.lines),
        { systemKey: "ACCOUNTS_PAYABLE" as const, creditKobo: e.totalKobo, ...(e.vendorId && { partyType: "VENDOR" as const, partyId: e.vendorId }) },
    ];
}

export function directLines(e: Pick<ExpenseEntity, "lines" | "totalKobo">, moneyAccountId: string): PostLine[] {
    return [
        ...e.lines.map(l => ({ accountId: l.ledgerAccountId, debitKobo: l.amountKobo })),
        ...vatLine(e.lines),
        { accountId: moneyAccountId, creditKobo: e.totalKobo },
    ];
}

export function billPaymentLines(vendorId: string | null, amountKobo: bigint, moneyAccountId: string): PostLine[] {
    return [
        { systemKey: "ACCOUNTS_PAYABLE" as const, debitKobo: amountKobo, ...(vendorId && { partyType: "VENDOR" as const, partyId: vendorId }) },
        { accountId: moneyAccountId, creditKobo: amountKobo },
    ];
}

/* ---------- repeating expenses ---------- */

const dayParts = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), d: Number(d.slice(8, 10)) });
const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addMonths(day: string, months: number): string {
    const p = dayParts(day);
    const total = p.y * 12 + (p.m - 1) + months;
    const y = Math.floor(total / 12), m = (total % 12) + 1;
    return `${y}-${pad(m)}-${pad(Math.min(p.d, daysInMonth(y, m)))}`;
}

export function addDays(day: string, days: number): string {
    const p = dayParts(day);
    return new Date(Date.UTC(p.y, p.m - 1, p.d + days)).toISOString().slice(0, 10);
}

/* The nth run date counted from the start (n = 0 is the start day). Counting from the start stops 31 January drifting to the 28th for ever. */
export function occurrence(startDay: string, frequency: RecurrenceFrequency, n: number): string {
    switch (frequency) {
        case "WEEKLY":  return addDays(startDay, 7 * n);
        case "MONTHLY": return addMonths(startDay, n);
        case "TERMLY":  return addMonths(startDay, MONTHS_PER_TERM * n);
        case "YEARLY":  return addMonths(startDay, 12 * n);
    }
}

/* The first run date after "after" (or the start day itself when nothing has run yet: pass after = null). */
export function nextRunAfter(startDay: string, frequency: RecurrenceFrequency, after: string | null): string {
    for (let n = 0; n < 5000; n++) {
        const d = occurrence(startDay, frequency, n);
        if (after === null || d > after) return d;
    }
    return occurrence(startDay, frequency, 5000);
}

/* ---------- budgets ---------- */

export interface BudgetLimit {
    ledgerAccountId: string; accountName: string; budgetId: string; budgetName: string; termId: string | null;
    plannedKobo: bigint; actualKobo: bigint;
}
export interface BudgetHit extends BudgetLimit { thisKobo: bigint; overByKobo: bigint }

/* Which limits this expense would break: what was already spent on the account, plus this expense's share, is more than planned. */
export function budgetHits(thisByAccount: Map<string, bigint>, limits: BudgetLimit[]): BudgetHit[] {
    const hits: BudgetHit[] = [];
    for (const l of limits) {
        const mine = thisByAccount.get(l.ledgerAccountId) ?? 0n;
        if (mine > 0n && l.actualKobo + mine > l.plannedKobo) hits.push({ ...l, thisKobo: mine, overByKobo: l.actualKobo + mine - l.plannedKobo });
    }
    return hits;
}

export function thisByAccount(lines: { ledgerAccountId: string; amountKobo: bigint }[]): Map<string, bigint> {
    const m = new Map<string, bigint>();
    for (const l of lines) m.set(l.ledgerAccountId, (m.get(l.ledgerAccountId) ?? 0n) + l.amountKobo);
    return m;
}
