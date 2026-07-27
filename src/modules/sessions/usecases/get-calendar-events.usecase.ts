import { ICalendarRepository } from "../repositories/calendar.repository";
import {
    CalendarEventMapper,
    CalendarEventResponseData,
} from "../mappers/calendar.mapper";
import { ListCalendarEventsDtoType } from "../dtos/calendar.dto";

interface Dependencies {
    calendarRepository: ICalendarRepository;
    calendarEventMapper: CalendarEventMapper;
}

export class GetCalendarEventsUseCase {
    private readonly calendarRepository: ICalendarRepository;
    private readonly calendarEventMapper: CalendarEventMapper;

    constructor({
        calendarRepository,
        calendarEventMapper,
    }: Dependencies) {
        this.calendarRepository = calendarRepository;
        this.calendarEventMapper = calendarEventMapper;
    }

    async execute(
        dto: ListCalendarEventsDtoType,
    ): Promise<CalendarEventResponseData[]> {
        const where: Record<string, any> = {};

        if (dto.termId) where.termId = dto.termId;
        if (dto.sessionId) where.sessionId = dto.sessionId;
        if (dto.type) where.type = dto.type;

        if (dto.startDate && dto.endDate) {
            where.startDate = {
                gte: new Date(dto.startDate),
                lte: new Date(dto.endDate),
            };
        }

        const events = await this.calendarRepository.findCalendarEvents(where);

        return events.map((event) =>
            this.calendarEventMapper.toResponse(event),
        );
    }
}