/*
| BILLING CALENDAR: pure date maths, all in UTC so the server's time zone never shifts a billing date.
| A paid period renews on its ANCHOR DAY: anchor 31 gives Jan 31 -> Feb 28 -> Mar 31 (it never drifts to the 28th).
*/
export type Cycle = "monthly" | "yearly";

export function addMonthsAnchored(from: Date, months: number, anchorDay: number): Date {
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(Math.max(anchorDay, 1), lastDay),
        from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}

export const addCycle = (from: Date, cycle: Cycle, anchorDay: number): Date =>
    addMonthsAnchored(from, cycle === "yearly" ? 12 : 1, anchorDay);

export const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);

/** Share of the period still unused at `now`, between 0 and 1. */
export function remainingFraction(start: Date, end: Date, now: Date): number {
    const total = end.getTime() - start.getTime();
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, (end.getTime() - now.getTime()) / total));
}

export const priceFor = (plan: { monthlyPriceKobo: number; yearlyPriceKobo: number }, cycle: Cycle): number =>
    cycle === "yearly" ? plan.yearlyPriceKobo : plan.monthlyPriceKobo;

export const monthlyEquivalent = (plan: { monthlyPriceKobo: number; yearlyPriceKobo: number }, cycle: Cycle): number =>
    cycle === "yearly" ? Math.round(plan.yearlyPriceKobo / 12) : plan.monthlyPriceKobo;
