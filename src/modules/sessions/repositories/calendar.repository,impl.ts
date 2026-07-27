import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { CalendarEventEntity } from "../domain/calendar.entity";
import { CalendarEventMapper } from "../mappers/calendar.mapper";
import { ICalendarRepository } from "./calendar.repository";

export class CalendarRepositoryImpl implements ICalendarRepository {
    private get db() {
        return getTenantClient();
    }

    constructor(
        private readonly calendarEventMapper: CalendarEventMapper,
    ) {}

    async createCalendarEvent(
        data: Record<string, any>,
    ): Promise<CalendarEventEntity> {
        const event = await this.db.calendarEvent.create({ data });

        return this.calendarEventMapper.toDomain(event);
    }

    async findCalendarEvents(
        where: Record<string, any>,
    ): Promise<CalendarEventEntity[]> {
        const events = await this.db.calendarEvent.findMany({
            where,
            orderBy: {
                startDate: "asc",
            },
        });

        return events.map((event) => this.calendarEventMapper.toDomain(event));
    }

    async deleteCalendarEvent(id: string): Promise<void> {
        await this.db.calendarEvent.delete({
            where: { id },
        });
    }

    async findUpcomingEvents(
        termId: string,
    ): Promise<CalendarEventEntity[]> {
        return this.findCalendarEvents({
            termId,
            startDate: {
                gte: new Date(),
            },
        });
    }
}