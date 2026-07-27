import { ICalendarRepository } from "../repositories/calendar.repository";
import {
    CalendarEventMapper,
    CalendarEventResponseData,
} from "../mappers/calendar.mapper";
import { CreateCalendarEventDtoType }  from "../dtos/calendar.dto";

interface Dependencies {
    calendarRepository: ICalendarRepository;
    calendarEventMapper: CalendarEventMapper;
}

export class CreateCalendarEventUseCase {
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
        dto:     CreateCalendarEventDtoType,
        staffId: string,
    ): Promise<CalendarEventResponseData> {
        const event = await this.calendarRepository.createCalendarEvent({
            title:       dto.title,
            description: dto.description,
            startDate:   new Date(dto.startDate),
            endDate:     dto.endDate ? new Date(dto.endDate) : null,
            type:        dto.type,
            isHoliday:   dto.isHoliday,
            termId:      dto.termId      ?? null,
            calendarId:   dto.calendarId   ?? null,
            createdById: staffId,
        });

        return this.calendarEventMapper.toResponse(event);
    }
}