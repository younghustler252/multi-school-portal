import { CalendarEventEntity } from "../domain/event.entity";

/*
| The audience (branches and classes) is part of the event: it is written together with it, in ONE database call, so an event is never half-saved.
| `data` holds the event's own columns; `branchIds` / `classIds`, when given, REPLACE the audience.
*/
export interface EventWrite { data: Record<string, any>; branchIds?: string[]; classIds?: string[] }

export interface ReminderRow { id: string; eventId: string; revision: number; offsetMinutes: number; dueAt: Date; status: string; attempts: number }
export interface PlannedReminder { revision: number; offsetMinutes: number; dueAt: Date; status: "PENDING" | "SKIPPED"; lastError: string | null }

export interface IEventRepository {
    create(write: EventWrite): Promise<CalendarEventEntity>;
    findById(id: string): Promise<CalendarEventEntity | null>;
    findMany(where: Record<string, any>): Promise<CalendarEventEntity[]>;
    update(id: string, write: EventWrite): Promise<CalendarEventEntity>;
    /** Erases the row. Callers only do this for drafts. */
    deleteDraft(id: string): Promise<void>;
    /** Makes the event's reminder rows equal to `planned` (current revision): missing ones are created, unwanted PENDING ones become CANCELLED. Sent/skipped history is kept. */
    syncReminders(eventId: string, planned: PlannedReminder[]): Promise<void>;
    /** Every still-PENDING reminder of the event becomes CANCELLED. */
    cancelPendingReminders(eventId: string): Promise<void>;
    /** PROCESSING rows older than `before` go back to PENDING (a worker died mid-way). Returns how many. */
    recoverStaleReminders(before: Date): Promise<number>;
    /** Takes up to `limit` due PENDING reminders for processing (each is claimed by exactly one caller). */
    claimDueReminders(now: Date, limit: number): Promise<ReminderRow[]>;
    finishReminder(id: string, status: "SENT" | "SKIPPED" | "CANCELLED" | "FAILED" | "PENDING", note?: string | null): Promise<void>;
    listReminders(eventId: string): Promise<ReminderRow[]>;
}
