/* How money and dates read inside a message. Pure; BigInt-safe (a balance is whole kobo and never goes through a float). */

/** 4500000n -> "₦45,000.00" */
export function formatNaira(kobo: bigint): string {
    const negative = kobo < 0n;
    const abs = negative ? -kobo : kobo;
    const naira = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const rest = (abs % 100n).toString().padStart(2, "0");
    return `${negative ? "-" : ""}₦${naira}.${rest}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-15" -> "15 Nov 2026" (a calendar day, no time zone involved) */
export function formatDay(day: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!m) return day;
    return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (day: string): number => { const [y, m, d] = day.split("-").map(Number); return Date.UTC(y, m - 1, d) / DAY_MS; };

/** Whole days from a to b (b - a), both YYYY-MM-DD. */
export const daysBetween = (a: string, b: string): number => dayNumber(b) - dayNumber(a);

export const addDays = (day: string, n: number): string => new Date((dayNumber(day) + n) * DAY_MS).toISOString().slice(0, 10);
