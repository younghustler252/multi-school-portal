import { eventErrors } from "./event.errors";
import type { EventAudienceKind } from "./event.entity";

/* PURE RULES for events (no database, easy to test). Everything here throws an eventErrors.* error or returns plain data. */

export const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MAX_REMINDERS = 5;
export const MIN_REMINDER_MINUTES = 5;
export const MAX_REMINDER_MINUTES = 90 * 24 * 60;        // 90 days
const STAFF_KINDS: readonly EventAudienceKind[] = ["TEACHING_STAFF", "NON_TEACHING_STAFF"];

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export interface Schedule { startDate: Date; endDate: Date | null; isAllDay: boolean; startTime: string | null; endTime: string | null }

/** The date and time fields must agree with each other. Returns the schedule with times cleared for an all-day event's null checks. */
export function assertSchedule(s: Schedule): void {
    if (s.endDate && s.endDate.getTime() < s.startDate.getTime()) throw eventErrors.endBeforeStart();
    if (s.isAllDay) {
        if (s.startTime || s.endTime) throw eventErrors.timeOnAllDay();
        return;
    }
    if (!s.startTime) throw eventErrors.timeRequired();
    // An end time only compares with the start time when the event ends on the same day
    const sameDay = !s.endDate || dayKey(s.endDate) === dayKey(s.startDate);
    if (s.endTime && sameDay && s.endTime <= s.startTime) throw eventErrors.endTimeNotAfterStart();
}

/** Did the part of the schedule that people plan around change? (a reschedule) */
export function scheduleChanged(a: Schedule, b: Schedule): boolean {
    return dayKey(a.startDate) !== dayKey(b.startDate)
        || (a.endDate ? dayKey(a.endDate) : null) !== (b.endDate ? dayKey(b.endDate) : null)
        || a.isAllDay !== b.isAllDay || (a.startTime ?? null) !== (b.startTime ?? null) || (a.endTime ?? null) !== (b.endTime ?? null);
}

/** "EVERYONE" already means all four groups, so it stands alone. Duplicates are removed. */
export function normaliseKinds(kinds: readonly EventAudienceKind[]): EventAudienceKind[] {
    const unique = [...new Set(kinds)];
    return unique.includes("EVERYONE") ? ["EVERYONE"] : unique;
}

export const includesStaff = (kinds: readonly EventAudienceKind[]): boolean =>
    kinds.includes("EVERYONE") || kinds.some(k => STAFF_KINDS.includes(k));

export interface AudienceShape { audienceKinds: readonly EventAudienceKind[]; branchIds: readonly string[]; classIds: readonly string[]; isHoliday: boolean }

export function assertAudience(a: AudienceShape): void {
    if (a.classIds.length > 0 && includesStaff(a.audienceKinds)) throw eventErrors.classWithStaff();
    // A holiday switches attendance off for the whole school, so it cannot be aimed at a part of it
    if (a.isHoliday && (!a.audienceKinds.includes("EVERYONE") || a.branchIds.length > 0 || a.classIds.length > 0)) throw eventErrors.holidayMustBeSchoolWide();
}

/** Reminder offsets in minutes before the start: unique, 5 minutes to 90 days, at most 5. Returned largest first. */
export function normaliseReminderOffsets(offsets: readonly number[]): number[] {
    const unique = [...new Set(offsets)];
    if (unique.length > MAX_REMINDERS) throw eventErrors.badReminderOffsets(`at most ${MAX_REMINDERS} per event`);
    for (const m of unique) {
        if (!Number.isInteger(m) || m < MIN_REMINDER_MINUTES || m > MAX_REMINDER_MINUTES) {
            throw eventErrors.badReminderOffsets(`each reminder must be between ${MIN_REMINDER_MINUTES} minutes and 90 days`);
        }
    }
    return unique.sort((x, y) => y - x);
}

/** Convenience presets for clients: one day, two days, one week, in minutes. */
export const REMINDER_PRESETS = { oneDay: 1440, twoDays: 2880, oneWeek: 10080 } as const;
