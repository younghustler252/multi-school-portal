/*
| PURE RULES for school years and terms (no database, so they are easy to test).
| A "range" is a start and end date, both days included.
*/
export interface DateRange { startDate: Date; endDate: Date }

export const isBefore = (a: Date, b: Date): boolean => a.getTime() < b.getTime();

/** Two ranges overlap when each starts on or before the day the other ends. */
export const rangesOverlap = (a: DateRange, b: DateRange): boolean =>
    a.startDate.getTime() <= b.endDate.getTime() && b.startDate.getTime() <= a.endDate.getTime();

export const rangeInside = (inner: DateRange, outer: DateRange): boolean =>
    inner.startDate.getTime() >= outer.startDate.getTime() && inner.endDate.getTime() <= outer.endDate.getTime();

/** The first range in `others` that overlaps `range`, ignoring the one with `ignoreId` (used when editing). */
export function firstOverlap<T extends DateRange & { id: string }>(range: DateRange, others: T[], ignoreId?: string): T | undefined {
    return others.find(o => o.id !== ignoreId && rangesOverlap(range, o));
}

/** "2025/2026": two four-digit years, the second one year after the first. */
export const SESSION_NAME = /^(\d{4})\/(\d{4})$/;
export function isValidSessionName(name: string): boolean {
    const m = SESSION_NAME.exec(name);
    return !!m && Number(m[2]) === Number(m[1]) + 1;
}

export const TERM_NAMES = ["first", "second", "third"] as const;
export type TermNameValue = typeof TERM_NAMES[number];

/** Parses a date sent as "YYYY-MM-DD" or a full ISO date. Returns null when it is not a real date. */
export function parseDate(value: string): Date | null {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
