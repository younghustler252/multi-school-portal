import type { CalendarEventEntity } from "./event.entity";
import { reminderAnchor } from "./event.notice";

/* PURE RULES for reminders. A reminder row = one offset of one schedule revision of one event. */
export type ReminderStatus = "PENDING" | "PROCESSING" | "SENT" | "SKIPPED" | "CANCELLED" | "FAILED";
export interface ReminderPlanRow { revision: number; offsetMinutes: number; dueAt: Date; status: "PENDING" | "SKIPPED"; lastError: string | null }
export const MAX_REMINDER_ATTEMPTS = 3;
export const STALE_PROCESSING_MINUTES = 30;

/*
| The rows for an event's CURRENT revision. Rows are always made, so the plan is visible and never silently missing;
| one whose due time has already passed is made SKIPPED (it never fires late). dueAt = reminder anchor - offset
| (anchor: the start time, or 08:00 school time for an all-day event).
*/
export function planReminders(e: Pick<CalendarEventEntity, "startDate" | "isAllDay" | "startTime" | "revision" | "reminderOffsetsMinutes">, timeZone: string, now: Date): ReminderPlanRow[] {
    const anchor = reminderAnchor(e, timeZone).getTime();
    return [...new Set(e.reminderOffsetsMinutes)].sort((a, b) => b - a).map(offsetMinutes => {
        const dueAt = new Date(anchor - offsetMinutes * 60_000);
        const past = dueAt.getTime() <= now.getTime();
        return { revision: e.revision, offsetMinutes, dueAt, status: past ? "SKIPPED" as const : "PENDING" as const, lastError: past ? "due time had already passed when planned" : null };
    });
}

/** "1 day", "2 hours", "90 minutes", "1 week": for the reminder text. */
export function humanOffset(minutes: number): string {
    const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
    if (minutes % 10080 === 0) return unit(minutes / 10080, "week");
    if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
    if (minutes % 60 === 0) return unit(minutes / 60, "hour");
    return unit(minutes, "minute");
}

export const reminderKey = (e: Pick<CalendarEventEntity, "id" | "revision">, offsetMinutes: number, recipientType: string, recipientId: string, channel: string): string =>
    `event:${e.id}:reminder:r${e.revision}:${offsetMinutes}:${recipientType}:${recipientId}:${channel}`;
