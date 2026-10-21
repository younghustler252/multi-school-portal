import { FINANCE_TIMEZONE } from "./ledger.constants";
import { ledgerErrors } from "./ledger.errors";

/*
| DATES IN THE BOOKS are plain calendar days ("2026-10-31"), never moments in time, so no time zone can move an entry
| into the wrong month. Only "today" depends on a time zone (postings may not be dated after today, Nigerian time).
*/

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-05" -> Date at UTC midnight. Rejects anything that is not a real calendar day. */
export function parseDay(value: string): Date {
    const m = DAY.exec(value);
    if (!m) throw ledgerErrors.invalidDate(value);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw ledgerErrors.invalidDate(value);
    return d;
}

export const dayString = (d: Date): string => d.toISOString().slice(0, 10);

/** Today's calendar day in the finance time zone, as YYYY-MM-DD. */
export function todayInFinanceZone(now: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FINANCE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);   // en-CA formats as YYYY-MM-DD
}

export interface PeriodDraft { name: string; startDate: string; endDate: string }

/** The accounting month (calendar month) that contains a day. */
export function monthContaining(day: string): PeriodDraft {
    const d = parseDay(day);
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    return {
        name:      `${y}-${pad(m + 1)}`,
        startDate: dayString(new Date(Date.UTC(y, m, 1))),
        endDate:   dayString(new Date(Date.UTC(y, m + 1, 0))),      // day 0 of next month = last day of this one
    };
}

/**
 * The 12 accounting months of the fiscal year that contains `today`.
 * Fiscal year starting in month 1 (January) and today in October 2026: 2026-01 ... 2026-12.
 * Starting in month 9 (September), today October 2026: 2026-09 ... 2027-08; today March 2026: 2025-09 ... 2026-08.
 */
export function monthlyPeriods(fiscalYearStartMonth: number, today: Date): PeriodDraft[] {
    if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
        throw new Error(`The fiscal year start month must be a whole number from 1 to 12 (got ${fiscalYearStartMonth}).`);
    }
    const thisMonth = today.getUTCMonth() + 1;
    const startYear = thisMonth >= fiscalYearStartMonth ? today.getUTCFullYear() : today.getUTCFullYear() - 1;

    const periods: PeriodDraft[] = [];
    for (let i = 0; i < 12; i++) {
        const index = fiscalYearStartMonth - 1 + i;
        const year  = startYear + Math.floor(index / 12);
        const month = index % 12;
        periods.push(monthContaining(`${year}-${pad(month + 1)}-01`));
    }
    return periods;
}
