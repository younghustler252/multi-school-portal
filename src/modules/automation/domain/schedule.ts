/*
|--------------------------------------------------------------------------
| SCHEDULES (pure: no database, no clock of its own)
| A rule runs "every day at 08:00" or "every Monday at 08:00", in Nigerian time (Africa/Lagos, UTC+1 all year: Nigeria has
| no daylight saving, so a fixed offset is exact). nextRunAfter() answers "when is the first run strictly after this moment".
|--------------------------------------------------------------------------
*/
export const SCHEDULE_UTC_OFFSET_MINUTES = 60;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTE = 60_000;
const DAY_MS = 24 * 60 * MINUTE;

export type Schedule =
    | { type: "daily";  time: string }
    | { type: "weekly"; weekday: number; time: string };      // weekday: 0 = Sunday ... 6 = Saturday

export const DEFAULT_SCHEDULE: Schedule = { type: "daily", time: "08:00" };

/** Problems with a schedule somebody is saving (empty means it is fine). */
export function validateSchedule(raw: unknown): string[] {
    if (!raw || typeof raw !== "object") return ["The schedule must say when to run"];
    const s = raw as Record<string, unknown>;
    const problems: string[] = [];
    const allowed = s.type === "weekly" ? ["type", "weekday", "time"] : ["type", "time"];
    for (const k of Object.keys(s)) if (!allowed.includes(k)) problems.push(`Unknown schedule field: ${k}`);
    if (s.type !== "daily" && s.type !== "weekly") problems.push("The schedule type must be daily or weekly");
    if (typeof s.time !== "string" || !TIME.test(s.time)) problems.push("The time must look like 08:00 (24 hour clock)");
    if (s.type === "weekly" && (!Number.isInteger(s.weekday) || (s.weekday as number) < 0 || (s.weekday as number) > 6)) {
        problems.push("The weekday must be 0 (Sunday) to 6 (Saturday)");
    }
    return problems;
}

/** A stored schedule that is no longer valid falls back to the default instead of stopping the rule. */
export function readSchedule(raw: unknown): Schedule {
    return validateSchedule(raw).length === 0 ? (raw as Schedule) : DEFAULT_SCHEDULE;
}

const minutesOf = (time: string): number => { const m = TIME.exec(time)!; return +m[1] * 60 + +m[2]; };

/** The first moment strictly after `after` that matches the schedule. */
export function nextRunAfter(schedule: Schedule, after: Date): Date {
    const offset = SCHEDULE_UTC_OFFSET_MINUTES * MINUTE;
    const local = after.getTime() + offset;                          // wall clock as if it were UTC
    const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
    const at = minutesOf(schedule.time) * MINUTE;

    for (let i = 0; i <= 7; i++) {
        const candidate = dayStart + i * DAY_MS + at;
        if (candidate <= local) continue;
        if (schedule.type === "weekly" && new Date(candidate).getUTCDay() !== schedule.weekday) continue;
        return new Date(candidate - offset);
    }
    throw new Error("unreachable: a daily or weekly schedule always has a next run within 8 days");
}

export const describeSchedule = (s: Schedule): string =>
    s.type === "daily" ? `Every day at ${s.time}` : `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][s.weekday]} at ${s.time}`;
