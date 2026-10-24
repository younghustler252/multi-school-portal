import { IMapper } from "../../../infrastructure/repository/base.repository";
import { CalendarEventEntity } from "../domain/calendar.entity";

// An event shows its term and session by NAME ({ id, name }), not by bare ids. `null` = the whole school.
export interface NameRef { id: string; name: string }

export interface CalendarEventResponseData {
    id:          string;
    title:       string;
    description: string | null;
    startDate:   Date;
    endDate:     Date | null;
    type:        string;
    isHoliday:   boolean;
    term:        NameRef | null;
    session:     NameRef | null;
    createdAt:   Date;
}

export class CalendarEventMapper implements IMapper<any, CalendarEventEntity> {
    toDomain(raw: any): CalendarEventEntity {
        return {
            id: raw.id, termId: raw.termId ?? null, sessionId: raw.sessionId ?? null, title: raw.title,
            description: raw.description ?? null, startDate: raw.startDate, endDate: raw.endDate ?? null,
            type: raw.type, isHoliday: raw.isHoliday, createdById: raw.createdById ?? null,
            createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        };
    }
    toResponse(entity: CalendarEventEntity, term: NameRef | null = null, session: NameRef | null = null): CalendarEventResponseData {
        return {
            id: entity.id, title: entity.title, description: entity.description, startDate: entity.startDate, endDate: entity.endDate,
            type: entity.type, isHoliday: entity.isHoliday, term, session, createdAt: entity.createdAt,
        };
    }
}
