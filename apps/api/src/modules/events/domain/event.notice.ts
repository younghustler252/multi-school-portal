import type { CalendarEventEntity, EventAudienceKind, EventStatus } from "./event.entity";
import type { StaffCategoryName } from "../../notifications/domain/audience";
import { includesStaff } from "./event.policy";

/* PURE RULES for event notices: who is meant, what the message says, when an event has started, and the keys that stop double sending. */
export type NoticeKind = "published" | "rescheduled" | "cancelled";
export const NOTICE_KINDS: readonly NoticeKind[] = ["published", "rescheduled", "cancelled"];
export const ALL_DAY_ANCHOR = "08:00";    // reminders for an all-day event are timed to 08:00 school time on the day

/** Which event status each notice belongs to. */
export const NOTICE_STATUS: Record<NoticeKind, EventStatus> = { published: "PUBLISHED", rescheduled: "PUBLISHED", cancelled: "CANCELLED" };

export interface Wants { students: boolean; guardians: boolean; staff: boolean; staffCategories?: StaffCategoryName[] }

/** Audience kinds → the groups to reach. Only teaching, or only non-teaching, staff narrows the staff group. */
export function wantsOf(kinds: readonly EventAudienceKind[]): Wants {
    const all = kinds.includes("EVERYONE");
    const teaching = all || kinds.includes("TEACHING_STAFF"), non = all || kinds.includes("NON_TEACHING_STAFF");
    return {
        students: all || kinds.includes("STUDENTS"), guardians: all || kinds.includes("GUARDIANS"), staff: includesStaff(kinds),
        staffCategories: teaching && non ? undefined : teaching ? ["teaching"] : non ? ["non_teaching"] : undefined,
    };
}

/** The stored target label of the notification (informational; the real recipients are resolved from the audience). */
export function targetTypeOf(kinds: readonly EventAudienceKind[]): "EVERYONE" | "ALL_STUDENTS" | "ALL_PARENTS" | "ALL_STAFF" {
    const w = wantsOf(kinds);
    const n = [w.students, w.guardians, w.staff].filter(Boolean).length;
    if (n !== 1) return "EVERYONE";
    return w.students ? "ALL_STUDENTS" : w.guardians ? "ALL_PARENTS" : "ALL_STAFF";
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** The instant (UTC) at which this wall-clock time happens in the given time zone. */
export function zonedInstant(day: string, hm: string, timeZone: string): Date {
    const [y, mo, d] = day.split("-").map(Number), [h, mi] = hm.split(":").map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const offsetAt = (t: number) => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
            .formatToParts(new Date(t)).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
        return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - t;
    };
    const first = guess - offsetAt(guess);
    return new Date(guess - offsetAt(first));
}

/** When the event begins: its start time on its start day, or 00:00 for an all-day event. */
export const startInstant = (e: Pick<CalendarEventEntity, "startDate" | "isAllDay" | "startTime">, tz: string): Date =>
    zonedInstant(dayKey(e.startDate), e.isAllDay || !e.startTime ? "00:00" : e.startTime, tz);

/** The moment reminders count back from (all-day events: 08:00 on the day). */
export const reminderAnchor = (e: Pick<CalendarEventEntity, "startDate" | "isAllDay" | "startTime">, tz: string): Date =>
    zonedInstant(dayKey(e.startDate), e.isAllDay || !e.startTime ? ALL_DAY_ANCHOR : e.startTime, tz);

export const hasStarted = (e: Pick<CalendarEventEntity, "startDate" | "isAllDay" | "startTime">, now: Date, tz: string): boolean =>
    startInstant(e, tz).getTime() <= now.getTime();

const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(d);

export function whenText(e: Pick<CalendarEventEntity, "startDate" | "endDate" | "isAllDay" | "startTime" | "endTime">): string {
    const sameDay = !e.endDate || dayKey(e.endDate) === dayKey(e.startDate);
    const dates = sameDay ? fmtDay(e.startDate) : `${fmtDay(e.startDate)} to ${fmtDay(e.endDate!)}`;
    if (e.isAllDay || !e.startTime) return `${dates} (all day)`;
    return `${dates}, ${e.startTime}${e.endTime ? `-${e.endTime}` : ""}`;
}

export function buildEventMessage(kind: NoticeKind, e: CalendarEventEntity): { title: string; message: string } {
    const where = e.location ? ` Venue: ${e.location}.` : "";
    const about = e.description ? ` ${e.description.trim().slice(0, 300)}` : "";
    if (kind === "published") return { title: `New event: ${e.title}`, message: `${e.title}: ${whenText(e)}.${where}${about}` };
    if (kind === "rescheduled") return { title: `Event rescheduled: ${e.title}`, message: `${e.title} has moved. New date: ${whenText(e)}.${where}` };
    return { title: `Event cancelled: ${e.title}`, message: `${e.title} (${whenText(e)}) has been cancelled.${e.cancelReason ? ` Reason: ${e.cancelReason}.` : ""}` };
}

/** One key per person, channel and notice. Published and cancelled happen once; each reschedule is its own revision. */
export const noticeKey = (e: Pick<CalendarEventEntity, "id" | "revision">, kind: NoticeKind, recipientType: string, recipientId: string, channel: string): string =>
    `event:${e.id}:${kind}${kind === "rescheduled" ? `:r${e.revision}` : ""}:${recipientType}:${recipientId}:${channel}`;
