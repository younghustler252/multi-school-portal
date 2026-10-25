import { Band, LineKind, PayComponentEntity, PayComponentType } from "./payroll.entity";

/*
|--------------------------------------------------------------------------
| PAY CALCULATION (pure). One staff member's month, from their basic salary, the components assigned to them and the loans due.
|
|   Earnings   FIXED (kobo) or PERCENT_OF_BASIC (basis points of basic).      gross = basic + every earning
|   Deductions and employer contributions
|              FIXED, PERCENT_OF_BASIC, PERCENT_OF_GROSS (of gross), or BANDED:
|              progressive slices of the month's TAXABLE pay (basic + earnings marked taxable), each slice at its own rate.
|   Loans      the monthly repayment, never more than what is still owed.
|   net = gross - deductions - loan repayments. It may not be negative.
| Nothing statutory is in here: every rate, limit and band comes from the school's own components (brief F9).
| Percentages round half up to a whole kobo. Amounts are BigInt kobo, rates are integer basis points (no floating point).
|--------------------------------------------------------------------------
*/

export interface AssignedComponent { component: PayComponentEntity; valueOverride: bigint | null }
export interface LoanDue { loanId: string; label: string; amountKobo: bigint }

export interface CalcLine {
    kind: LineKind; componentId: string | null; loanId: string | null; label: string; type: PayComponentType; amountKobo: bigint;
    expenseAccountId: string | null; liabilityAccountId: string | null; sortOrder: number;
}

export interface CalcResult {
    lines: CalcLine[]; grossKobo: bigint; taxableKobo: bigint; deductionsKobo: bigint; loanRepaymentKobo: bigint;
    totalDeductionsKobo: bigint;                 // deductions plus loan repayments: what comes off gross
    employerContributionKobo: bigint; netKobo: bigint;
}

/** `base` times `rateBp` basis points, rounded half up. */
export const percentOf = (base: bigint, rateBp: bigint): bigint => (base * rateBp + 5000n) / 10000n;

/** Progressive slices: each band taxes the part of `amount` between the previous limit and its own limit. */
export function bandedAmount(amount: bigint, bands: Band[]): bigint {
    let total = 0n, floor = 0n;
    for (const b of bands) {
        if (amount <= floor) break;
        const ceiling = b.upToKobo === null ? amount : (b.upToKobo < amount ? b.upToKobo : amount);
        if (ceiling > floor) total += percentOf(ceiling - floor, BigInt(b.rateBp));
        if (b.upToKobo === null) break;
        floor = b.upToKobo;
    }
    return total;
}

const ORDER: Record<PayComponentType, number> = { EARNING: 1, DEDUCTION: 2, EMPLOYER_CONTRIBUTION: 4 };

export function calculatePay(basicKobo: bigint, assigned: AssignedComponent[], loans: LoanDue[]): CalcResult {
    const lines: CalcLine[] = [];
    const push = (l: Omit<CalcLine, "sortOrder">) => lines.push({ ...l, sortOrder: 0 });
    const valueOf = (a: AssignedComponent): bigint => a.valueOverride ?? a.component.defaultValue;

    push({ kind: "BASIC", componentId: null, loanId: null, label: "Basic salary", type: "EARNING", amountKobo: basicKobo, expenseAccountId: null, liabilityAccountId: null });

    // earnings first: they make up the gross every other rule leans on
    let gross = basicKobo, taxable = basicKobo;
    for (const a of assigned.filter(x => x.component.type === "EARNING")) {
        const amount = a.component.calcType === "PERCENT_OF_BASIC" ? percentOf(basicKobo, valueOf(a)) : valueOf(a);
        if (amount <= 0n) continue;
        gross += amount;
        if (a.component.isTaxable) taxable += amount;
        push({ kind: "COMPONENT", componentId: a.component.id, loanId: null, label: a.component.name, type: "EARNING", amountKobo: amount, expenseAccountId: a.component.expenseAccountId, liabilityAccountId: null });
    }

    const amountFor = (a: AssignedComponent): bigint => {
        switch (a.component.calcType) {
            case "FIXED": return valueOf(a);
            case "PERCENT_OF_BASIC": return percentOf(basicKobo, valueOf(a));
            case "PERCENT_OF_GROSS": return percentOf(gross, valueOf(a));
            case "BANDED": return bandedAmount(taxable, a.component.bands ?? []);
        }
    };

    let deductions = 0n, employer = 0n;
    for (const a of assigned.filter(x => x.component.type === "DEDUCTION")) {
        const amount = amountFor(a);
        if (amount <= 0n) continue;
        deductions += amount;
        push({ kind: "COMPONENT", componentId: a.component.id, loanId: null, label: a.component.name, type: "DEDUCTION", amountKobo: amount, expenseAccountId: null, liabilityAccountId: a.component.liabilityAccountId });
    }

    let loanTotal = 0n;
    for (const l of loans) {
        if (l.amountKobo <= 0n) continue;
        loanTotal += l.amountKobo;
        push({ kind: "LOAN", componentId: null, loanId: l.loanId, label: l.label, type: "DEDUCTION", amountKobo: l.amountKobo, expenseAccountId: null, liabilityAccountId: null });
    }

    for (const a of assigned.filter(x => x.component.type === "EMPLOYER_CONTRIBUTION")) {
        const amount = amountFor(a);
        if (amount <= 0n) continue;
        employer += amount;
        push({ kind: "COMPONENT", componentId: a.component.id, loanId: null, label: a.component.name, type: "EMPLOYER_CONTRIBUTION", amountKobo: amount, expenseAccountId: a.component.expenseAccountId, liabilityAccountId: a.component.liabilityAccountId });
    }

    // a stable order for the payslip: basic and earnings, deductions, loans, employer contributions
    const rank = (l: CalcLine) => (l.kind === "BASIC" ? 0 : l.kind === "LOAN" ? 3 : ORDER[l.type]);
    const ordered = lines.map((l, i) => ({ l, i })).sort((x, y) => rank(x.l) - rank(y.l) || x.i - y.i).map((x, n) => ({ ...x.l, sortOrder: n }));

    const totalDeductionsKobo = deductions + loanTotal;
    return {
        lines: ordered, grossKobo: gross, taxableKobo: taxable, deductionsKobo: deductions, loanRepaymentKobo: loanTotal, totalDeductionsKobo,
        employerContributionKobo: employer, netKobo: gross - totalDeductionsKobo,
    };
}

/** What a loan takes this month: the agreed repayment, or what is left if that is less. */
export const loanInstalment = (monthlyKobo: bigint, balanceKobo: bigint): bigint => (monthlyKobo < balanceKobo ? monthlyKobo : balanceKobo);
