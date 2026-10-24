import { AuditService } from "../../audit/services/audit.service";
import { ICalendarRepository } from "../repositories/calendar.repository";
import { ISessionRepository } from "../repositories/session.repository";
import { CalendarEventMapper, CalendarEventResponseData, NameRef } from "../mappers/calendar.mapper";
import { CalendarEventEntity } from "../domain/calendar.entity";
import { sessionErrors } from "../domain/session.errors";
import { SessionActor } from "../domain/session.types";
import { CreateCalendarEventDtoType, UpdateCalendarEventDtoType, ListCalendarEventsQueryType } from "../dtos/calendar.dto";

interface Dependencies { calendarRepository: ICalendarRepository; sessionRepository: ISessionRepository; calendarEventMapper: CalendarEventMapper; auditService: AuditService }
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Fills in term and session NAMES for a list of events with ONE lookup (sessions come with their terms). */
async function present(d: Dependencies, events: CalendarEventEntity[]): Promise<CalendarEventResponseData[]> {
    const sessions = await d.sessionRepository.findAllSessions();
    const sessionRef = new Map<string, NameRef>(sessions.map(s => [s.id, { id: s.id, name: s.name }]));
    const termRef = new Map<string, NameRef & { sessionId: string }>(sessions.flatMap(s => (s.terms ?? []).map(t => [t.id, { id: t.id, name: t.name, sessionId: s.id }] as const)));
    return events.map(e => {
        const t = e.termId ? termRef.get(e.termId) : undefined;
        const sessionId = e.sessionId ?? t?.sessionId ?? null;
        return d.calendarEventMapper.toResponse(e, t ? { id: t.id, name: t.name } : null, sessionId ? sessionRef.get(sessionId) ?? null : null);
    });
}

export class ListCalendarEventsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListCalendarEventsQueryType): Promise<CalendarEventResponseData[]> {
        const where: Record<string, unknown> = {};
        if (q.termId) where.termId = q.termId;
        if (q.sessionId) where.sessionId = q.sessionId;
        if (q.type) where.type = q.type;
        if (q.from || q.to) where.startDate = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
        return present(this.d, await this.d.calendarRepository.findCalendarEvents(where));
    }
}

/* CREATE EVENT. An event belongs to a term OR a session OR the whole school. (The old version wrote a column that does not exist.) */
export class CreateCalendarEventUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, dto: CreateCalendarEventDtoType, actor: SessionActor): Promise<CalendarEventResponseData> {
        const { sessionRepository: sessions, calendarRepository: repo } = this.d;
        let sessionId: string | null = dto.sessionId ?? null;
        if (dto.termId) {
            const term = await sessions.findTermById(dto.termId);
            if (!term) throw sessionErrors.termNotFound();
            if (sessionId && sessionId !== term.sessionId) throw sessionErrors.badEventScope();
            sessionId = term.sessionId;
        }
        if (sessionId && !(await sessions.findSessionById(sessionId))) throw sessionErrors.sessionNotFound();

        const created = await repo.createCalendarEvent({
            title: dto.title, description: dto.description, startDate: new Date(dto.startDate), endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            type: dto.type, isHoliday: dto.type === "holiday" || !!dto.isHoliday, termId: dto.termId ?? null, sessionId, createdById: actor.userId,
        });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.created", entity: "CalendarEvent", entityId: created.id, newValue: { title: dto.title, type: dto.type, startDate: dto.startDate } });
        return (await present(this.d, [created]))[0];
    }
}

/* UPDATE EVENT. Only changed fields are written and audited. */
export class UpdateCalendarEventUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, dto: UpdateCalendarEventDtoType, actor: SessionActor): Promise<CalendarEventResponseData> {
        const { calendarRepository: repo } = this.d;
        const event = await repo.findCalendarEventById(id);
        if (!event) throw sessionErrors.eventNotFound();

        const start = dto.startDate ? new Date(dto.startDate) : event.startDate;
        const end = dto.endDate === undefined ? event.endDate : dto.endDate ? new Date(dto.endDate) : null;
        if (end && end.getTime() < start.getTime()) throw sessionErrors.endBeforeStart();

        const data: Record<string, unknown> = {}, before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        const set = (k: string, now: unknown, was: unknown) => { if (now !== was) { data[k] = now; before[k] = was; after[k] = now; } };
        if (dto.title !== undefined) set("title", dto.title, event.title);
        if (dto.description !== undefined) set("description", dto.description, event.description);
        if (dto.type !== undefined) set("type", dto.type, event.type);
        if (dto.startDate !== undefined && day(start) !== day(event.startDate)) { data.startDate = start; before.startDate = day(event.startDate); after.startDate = day(start); }
        if (dto.endDate !== undefined && day(end) !== day(event.endDate)) { data.endDate = end; before.endDate = day(event.endDate); after.endDate = day(end); }
        const type = (dto.type ?? event.type) as string;
        const holiday = type === "holiday" || (dto.isHoliday ?? event.isHoliday);
        set("isHoliday", holiday, event.isHoliday);
        if (Object.keys(data).length === 0) return (await present(this.d, [event]))[0];

        const updated = await repo.updateCalendarEvent(id, data);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.updated", entity: "CalendarEvent", entityId: id, oldValue: before, newValue: after });
        return (await present(this.d, [updated]))[0];
    }
}

export class DeleteCalendarEventUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, actor: SessionActor): Promise<{ deleted: true; title: string }> {
        const event = await this.d.calendarRepository.findCalendarEventById(id);
        if (!event) throw sessionErrors.eventNotFound();
        await this.d.calendarRepository.deleteCalendarEvent(id);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.deleted", entity: "CalendarEvent", entityId: id, oldValue: { title: event.title, startDate: day(event.startDate) } });
        return { deleted: true, title: event.title };
    }
}
