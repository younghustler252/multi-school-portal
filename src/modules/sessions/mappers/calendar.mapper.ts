import { IMapper } from "../../../infrastructure/repository/base.repository";
import { CalendarEventEntity } from "../domain/calendar.entity";
// import



export interface CalendarEventResponseData {
    id:          string;
    termId:      string | null;
    sessionId:   string | null;
    title:       string;
    description: string | null;
    startDate:   Date;
    endDate:     Date | null;
    type:        string;
    isHoliday:   boolean;
    createdAt:   Date;
}

export class CalendarEventMapper
    implements IMapper<any, CalendarEventEntity>
{
    toDomain(raw: any): CalendarEventEntity {
        return {
            id:          raw.id,
            termId:      raw.termId      ?? null,
            sessionId:   raw.sessionId   ?? null,
            title:       raw.title,
            description: raw.description ?? null,
            startDate:   raw.startDate,
            endDate:     raw.endDate     ?? null,
            type:        raw.type,
            isHoliday:   raw.isHoliday,
            createdById: raw.createdById ?? null,
            createdAt:   raw.createdAt,
            updatedAt:   raw.updatedAt,
        };
    }

    toResponse(entity: CalendarEventEntity): CalendarEventResponseData {
        return {
            id:          entity.id,
            termId:      entity.termId,
            sessionId:   entity.sessionId,
            title:       entity.title,
            description: entity.description,
            startDate:   entity.startDate,
            endDate:     entity.endDate,
            type:        entity.type,
            isHoliday:   entity.isHoliday,
            createdAt:   entity.createdAt,
        };
    }
}