/*
|--------------------------------------------------------------------------
| ATTENDANCE RULES (pure: no database, easy to test)
| A school day is a calendar date "YYYY-MM-DD". It is stored as that date at 00:00 UTC and compared by its date
| text, never by clock time, so one student can never get two records for one day.
|--------------------------------------------------------------------------
*/
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatusValue = typeof ATTENDANCE_STATUSES[number];

// Settings that do not exist yet are constants (replace in one place when the settings service is built).
export const SCHOOL_TIME_ZONE = "Africa/Lagos";   // v1 is Nigeria only
export const EDIT_WINDOW_HOURS = 48;               // a mark can be changed this long after it was first made
export const LOW_ATTENDANCE_PERCENT = 75;          // below this the summary flags "low attendance"
export const MAX_REGISTER_ENTRIES = 200;
export const ENROLMENT_STATUSES_ON_REGISTER = ["active", "completed"] as const;   // withdrawn / transferred are not on the register

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-26" -> that date at 00:00 UTC. Anything that is not a real calendar date (or has a time) -> null. */
export function parseSchoolDay(value: string): Date | null {
    if (!DAY_PATTERN.test(value)) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);

/** Today's date at the school (not the server's clock zone), as "YYYY-MM-DD". */
export function todayKey(now: Date = new Date(), timeZone: string = SCHOOL_TIME_ZONE): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const isFutureDay = (day: string, now: Date = new Date()): boolean => day > todayKey(now);

export interface TermLike { id: string; startDate: Date; endDate: Date }

export type TermForDay<T extends TermLike> = { kind: "found"; term: T } | { kind: "none" } | { kind: "ambiguous"; ids: string[] };

/** The term a day belongs to (both end dates count). Terms should never overlap; if they do, nothing is guessed. */
export function termForDay<T extends TermLike>(terms: T[], day: string): TermForDay<T> {
    const hits = terms.filter(t => dayKey(t.startDate) <= day && day <= dayKey(t.endDate));
    if (hits.length === 0) return { kind: "none" };
    if (hits.length > 1) return { kind: "ambiguous", ids: hits.map(t => t.id) };
    return { kind: "found", term: hits[0] };
}

export interface HolidayLike { title: string; isHoliday: boolean; startDate: Date; endDate: Date | null }

/** The calendar holiday that covers a day (a one-day event, or start to end inclusive). */
export function holidayOn<T extends HolidayLike>(events: T[], day: string): T | undefined {
    return events.find(e => e.isHoliday && dayKey(e.startDate) <= day && day <= dayKey(e.endDate ?? e.startDate));
}

/** A mark can be changed within the window counted from when it was first made. */
export const withinEditWindow = (createdAt: Date, now: Date = new Date(), hours: number = EDIT_WINDOW_HOURS): boolean =>
    now.getTime() - createdAt.getTime() <= hours * 3_600_000;

export type Counts = Partial<Record<AttendanceStatusValue, number>>;

export interface AttendanceSummary {
    present: number; late: number; absent: number; excused: number;
    daysMarked: number;        // days with any mark (present + late + absent + excused)
    timesPresent: number;      // present + late
    rate: number | null;       // (present + late) / (present + late + absent) x 100, one decimal; excused is left out
    lowAttendance: boolean;
}

/** Excused days are shown on their own and are not in the rate; days nobody marked are reported separately by the caller. */
export function summarize(c: Counts): AttendanceSummary {
    const present = c.present ?? 0, late = c.late ?? 0, absent = c.absent ?? 0, excused = c.excused ?? 0;
    const timesPresent = present + late, counted = timesPresent + absent;
    const rate = counted === 0 ? null : Math.round((timesPresent / counted) * 1000) / 10;
    return { present, late, absent, excused, daysMarked: counted + excused, timesPresent, rate, lowAttendance: rate !== null && rate < LOW_ATTENDANCE_PERCENT };
}
