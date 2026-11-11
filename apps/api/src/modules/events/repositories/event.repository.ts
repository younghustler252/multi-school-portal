import { CalendarEventEntity } from "../domain/event.entity";

/*
| The audience (branches and classes) is part of the event: it is written together with it, in ONE database call, so an event is never half-saved.
| `data` holds the event's own columns; `branchIds` / `classIds`, when given, REPLACE the audience.
*/
export interface EventWrite { data: Record<string, any>; branchIds?: string[]; classIds?: string[] }

export interface IEventRepository {
    create(write: EventWrite): Promise<CalendarEventEntity>;
    findById(id: string): Promise<CalendarEventEntity | null>;
    findMany(where: Record<string, any>): Promise<CalendarEventEntity[]>;
    update(id: string, write: EventWrite): Promise<CalendarEventEntity>;
    /** Erases the row. Callers only do this for drafts. */
    deleteDraft(id: string): Promise<void>;
}
