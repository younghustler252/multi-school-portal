import { CalendarEventEntity } from "../domain/calendar.entity";

export interface ICalendarRepository {
    createCalendarEvent(data: Record<string, any>): Promise<CalendarEventEntity>;
    findCalendarEventById(id: string): Promise<CalendarEventEntity | null>;
    findCalendarEvents(where: Record<string, any>): Promise<CalendarEventEntity[]>;
    updateCalendarEvent(id: string, data: Record<string, any>): Promise<CalendarEventEntity>;
    deleteCalendarEvent(id: string): Promise<void>;
    findUpcomingEvents(termId: string): Promise<CalendarEventEntity[]>;
}
