import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { CalendarEventEntity } from "../domain/calendar.entity";
import { CalendarEventMapper } from "../mappers/calendar.mapper";
import { ICalendarRepository } from "./calendar.repository";

export class CalendarRepositoryImpl
    extends BaseTenantRepository<CalendarEventEntity>
    implements ICalendarRepository
{
    protected readonly modelName = "calendarEvent";

    constructor({ calendarEventMapper }: { calendarEventMapper: CalendarEventMapper }) {
        super(calendarEventMapper);
    }

    async createCalendarEvent(data: Record<string, any>): Promise<CalendarEventEntity> {
        return this.create(data);
    }

    async findCalendarEvents(where: Record<string, any>): Promise<CalendarEventEntity[]> {
        return this.findMany(where, undefined, { startDate: "asc" });
    }

    async deleteCalendarEvent(id: string): Promise<void> {
        await this.delete(id);
    }

    async findUpcomingEvents(termId: string): Promise<CalendarEventEntity[]> {
        return this.findCalendarEvents({
            termId,
            startDate: { gte: new Date() },
        });
    }
}