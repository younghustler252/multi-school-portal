import type { PostLine } from "../../ledger/services/posting.service";
import { Band, PayCalcType, PayComponentType, PayslipEntity } from "./payroll.entity";
import { payrollErrors } from "./payroll.errors";

/*
| PAYROLL RULES (brief 7.12, 7.13, 8.11) in plain functions: no database, no clock.
| Until the settings service exists these values are constants (each names the setting that will replace it):
*/
export const ALLOW_SELF_APPROVAL = false;      // finance.allow_self_approval
export const RUN_PREFIX = "PR";
export const PAYSLIP_PREFIX = "PSL";           // finance.payslip_prefix

export const runNumber = (year: string, n: number): string => `${RUN_PREFIX}-${year}-${String(n).padStart(6, "0")}`;
export const payslipNumber = (year: string, n: number): string => `${PAYSLIP_PREFIX}-${year}-${String(n).padStart(6, "0")}`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (year: number, month: number): string => `${MONTHS[month - 1]} ${year}`;
export const lastDayOfMonth = (year: number, month: number): string => {
    const d = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
export const firstDayOfMonth = (year: number, month: number): string => `${year}-${String(month).padStart(2, "0")}-01`;

/* ---------- pay components ---------- */
export interface ComponentInput {
    type: PayComponentType; calcType: PayCalcType; defaultValue: bigint; bands: Band[] | null;
    expenseAccountId?: string | null; liabilityAccountId?: string | null;
}

/* The shapes a component may take, so a payslip can always be worked out and posted. */
export function checkComponent(c: ComponentInput): void {
    const bad = (m: string) => { throw payrollErrors.componentInvalid(m); };
    if (c.type === "EARNING" && (c.calcType === "PERCENT_OF_GROSS" || c.calcType === "BANDED")) bad("An earning is either a fixed amount or a percentage of basic salary");
    if (c.type !== "EARNING" && !c.liabilityAccountId) bad("A deduction or employer contribution needs the liability account it is owed to (for example Tax payable or Pension payable)");
    if (c.type === "EARNING" && c.liabilityAccountId) bad("An earning has no liability account");
    if (c.type === "DEDUCTION" && c.expenseAccountId) bad("A deduction has no expense account: it comes out of the staff member's pay");
    if (c.calcType === "BANDED") {
        if (!c.bands || c.bands.length === 0) bad("A banded component needs at least one band");
        let prev = 0n;
        c.bands!.forEach((b, i) => {
            if (b.rateBp < 0 || b.rateBp > 10000) bad("A band rate must be between 0% and 100%");
            if (b.upToKobo === null) { if (i !== c.bands!.length - 1) bad("Only the last band can have no upper limit"); }
            else { if (b.upToKobo <= prev) bad("Band limits must rise from one band to the next"); prev = b.upToKobo; }
        });
    } else {
        if (c.bands) bad("Only a banded component has bands");
        if (c.calcType !== "FIXED" && (c.defaultValue < 0n || c.defaultValue > 10000n)) bad("A percentage is entered in basis points, from 0 to 10000 (1000 is 10%)");
        if (c.defaultValue < 0n) bad("The value cannot be negative");
    }
}

/* ---------- posting lines ---------- */
type Account = { accountId: string } | { systemKey: "SALARIES_EXPENSE" | "EMPLOYER_PENSION_EXPENSE" };
const accountKey = (a: Account): string => ("accountId" in a ? a.accountId : `sys:${a.systemKey}`);

/** Adds an amount to a group, so a hundred payslips make one line per account, not a hundred. */
class Totals {
    private readonly m = new Map<string, { account: Account; kobo: bigint }>();
    add(account: Account, kobo: bigint) { if (kobo <= 0n) return; const k = accountKey(account); const e = this.m.get(k); e ? (e.kobo += kobo) : this.m.set(k, { account, kobo }); }
    entries() { return [...this.m.values()]; }
}

type PayslipForPosting = Pick<PayslipEntity, "staffId" | "netKobo" | "lines">;

/*
| APPROVED RUN (the accrual):
|   Dr Salaries expense (basic and earnings, or the component's own expense account)
|   Dr Employer pension expense (employer contributions, or the component's own expense account)
|   Cr Salaries payable (each person's net pay, party: the staff member)
|   Cr the liability account of each deduction and employer contribution (Tax payable, Pension payable, ...)
|   Cr Staff loans receivable (loan repayments taken, party: the staff member)
*/
export function accrualLines(payslips: PayslipForPosting[]): PostLine[] {
    const debits = new Totals(), liabilities = new Totals();
    const credits: PostLine[] = [];

    for (const p of payslips) {
        let loans = 0n;
        for (const l of p.lines) {
            if (l.type === "EARNING") debits.add(l.expenseAccountId ? { accountId: l.expenseAccountId } : { systemKey: "SALARIES_EXPENSE" }, l.amountKobo);
            else if (l.type === "EMPLOYER_CONTRIBUTION") {
                debits.add(l.expenseAccountId ? { accountId: l.expenseAccountId } : { systemKey: "EMPLOYER_PENSION_EXPENSE" }, l.amountKobo);
                liabilities.add({ accountId: l.liabilityAccountId! }, l.amountKobo);
            } else if (l.kind === "LOAN") loans += l.amountKobo;
            else liabilities.add({ accountId: l.liabilityAccountId! }, l.amountKobo);
        }
        if (p.netKobo > 0n) credits.push({ systemKey: "SALARIES_PAYABLE", creditKobo: p.netKobo, partyType: "STAFF", partyId: p.staffId });
        if (loans > 0n) credits.push({ systemKey: "STAFF_LOANS_RECEIVABLE", creditKobo: loans, partyType: "STAFF", partyId: p.staffId });
    }
    return [
        ...debits.entries().map(e => ({ ...e.account, debitKobo: e.kobo }) as PostLine),
        ...credits,
        ...liabilities.entries().map(e => ({ ...e.account, creditKobo: e.kobo }) as PostLine),
    ];
}

/* PAID RUN: Dr Salaries payable (each person, party: the staff member), Cr the money account. */
export function paymentLines(payslips: Pick<PayslipEntity, "staffId" | "netKobo">[], moneyAccountId: string): PostLine[] {
    const owed = payslips.filter(p => p.netKobo > 0n);
    const total = owed.reduce((s, p) => s + p.netKobo, 0n);
    return [
        ...owed.map(p => ({ systemKey: "SALARIES_PAYABLE" as const, debitKobo: p.netKobo, partyType: "STAFF" as const, partyId: p.staffId })),
        { accountId: moneyAccountId, creditKobo: total },
    ];
}

/* REMITTANCE: Dr the liability account (Tax payable, Pension payable), Cr the money account. */
export const remittanceLines = (liabilityAccountId: string, moneyAccountId: string, amountKobo: bigint): PostLine[] => [
    { accountId: liabilityAccountId, debitKobo: amountKobo }, { accountId: moneyAccountId, creditKobo: amountKobo },
];

/* LOAN PAID OUT: Dr Staff loans receivable (party: the staff member), Cr the money account it left. */
export const loanDisbursementLines = (staffId: string, moneyAccountId: string, amountKobo: bigint): PostLine[] => [
    { systemKey: "STAFF_LOANS_RECEIVABLE", debitKobo: amountKobo, partyType: "STAFF", partyId: staffId }, { accountId: moneyAccountId, creditKobo: amountKobo },
];
