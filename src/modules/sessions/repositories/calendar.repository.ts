
import { CalendarEventEntity } from "../domain/calendar.entity";

export interface ICalendarRepository {
    // ── Calendar Events ───────────────────────────────────────────────────────
    createCalendarEvent(data: Record<string, any>):     Promise<CalendarEventEntity>;
    findCalendarEvents(
        where: Record<string, any>,
    ):                                                  Promise<CalendarEventEntity[]>;
    deleteCalendarEvent(id: string):                    Promise<void>;
    findUpcomingEvents(termId: string):                 Promise<CalendarEventEntity[]>;

}