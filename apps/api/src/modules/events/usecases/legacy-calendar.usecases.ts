import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { sessionErrors } from "../../sessions/domain/session.errors";
import { SessionActor } from "../../sessions/domain/session.types";
import { IEventRepository } from "../repositories/event.repository";
import { EventMapper, LegacyCalendarEventResponseData } from "../mappers/event.mapper";
import { CalendarEventEntity } from "../domain/event.entity";
import { scheduleChanged } from "../domain/event.policy";
import { eventErrors } from "../domain/event.errors";
import { CreateCalendarEventDtoType, UpdateCalendarEventDtoType, ListCalendarEventsQueryType } from "../dtos/legacy-calendar.dto";
import { CancelEventUseCase } from "./events.usecases";
import type { EventReminderService } from "../services/event-reminder.service";
import { nameLookup } from "./event-presenter";

/*
| THE OLD CALENDAR ROUTES (/sessions/calendar/events). Same requests, same responses as before, now on top of the events model:
|  - an event made here is PUBLISHED for everyone, with no notification (that is what it always meant);
|  - the list shows published events only; a draft or cancelled event is "not found" for update;
|  - DELETE of a published event cancels it (history is kept) and says so with extra fields; a draft is really deleted.
*/
interface Deps { eventRepository: IEventRepository; sessionRepository: ISessionRepository; eventMapper: EventMapper; auditService: AuditService; cancelEventUseCase: CancelEventUseCase; eventReminderService?: EventReminderService }
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function present(d: Deps, events: CalendarEventEntity[]): Promise<LegacyCalendarEventResponseData[]> {
    const names = await nameLookup(d.sessionRepository, events);
    return events.map(e => { const n = names(e); return d.eventMapper.toLegacyResponse(e, n.term, n.session); });
}

export class ListCalendarEventsUseCase {
    constructor(private readonly d: Deps) {}
    async execute(q: ListCalendarEventsQueryType): Promise<LegacyCalendarEventResponseData[]> {
        const where: Record<string, unknown> = { status: "PUBLISHED" };
        if (q.termId) where.termId = q.termId;
        if (q.sessionId) where.sessionId = q.sessionId;
        if (q.type) where.type = q.type;
        if (q.from || q.to) where.startDate = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
        return present(this.d, await this.d.eventRepository.findMany(where));
    }
}

export class CreateCalendarEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, dto: CreateCalendarEventDtoType, actor: SessionActor): Promise<LegacyCalendarEventResponseData> {
        const { sessionRepository: sessions, eventRepository: repo } = this.d;
        let sessionId: string | null = dto.sessionId ?? null;
        if (dto.termId) {
            const term = await sessions.findTermById(dto.termId);
            if (!term) throw sessionErrors.termNotFound();
            if (sessionId && sessionId !== term.sessionId) throw sessionErrors.badEventScope();
            sessionId = term.sessionId;
        }
        if (sessionId && !(await sessions.findSessionById(sessionId))) throw sessionErrors.sessionNotFound();

        if (dto.isHoliday && dto.type !== "holiday") throw eventErrors.holidayRequiresHolidayType();      // it used to be silently accepted; the flag is derived from the type now
        const created = await repo.create({ data: {
            title: dto.title, description: dto.description, startDate: new Date(dto.startDate), endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            type: dto.type, isHoliday: dto.type === "holiday", termId: dto.termId ?? null, sessionId, createdById: actor.userId,
            status: "PUBLISHED", isAllDay: true, audienceKinds: ["EVERYONE"], publishedAt: new Date(), publishedById: actor.userId, updatedById: actor.userId,
        } });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.created", entity: "CalendarEvent", entityId: created.id, newValue: { title: dto.title, type: dto.type, startDate: dto.startDate } });
        return (await present(this.d, [created]))[0];
    }
}

export class UpdateCalendarEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, dto: UpdateCalendarEventDtoType, actor: SessionActor): Promise<LegacyCalendarEventResponseData> {
        const { eventRepository: repo } = this.d;
        const event = await repo.findById(id);
        if (!event || event.status !== "PUBLISHED") throw sessionErrors.eventNotFound();

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
        if (dto.isHoliday === true && type !== "holiday") throw eventErrors.holidayRequiresHolidayType();
        set("isHoliday", type === "holiday", event.isHoliday);          // derived from the type (the database does the same)
        if (Object.keys(data).length === 0) return (await present(this.d, [event]))[0];

        // A moved date is a new schedule revision (reminders belong to a revision)
        if (scheduleChanged(event, { ...event, startDate: start, endDate: end })) data.revision = event.revision + 1;
        data.updatedById = actor.userId;
        const updated = await repo.update(id, { data });
        if (data.revision) await this.d.eventReminderService?.sync(schoolId, updated);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.updated", entity: "CalendarEvent", entityId: id, oldValue: before, newValue: after });
        return (await present(this.d, [updated]))[0];
    }
}

export type LegacyDeleteResult = { deleted: true; title: string } | { deleted: true; title: string; cancelled: true; status: "CANCELLED" };

export class DeleteCalendarEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, actor: SessionActor): Promise<LegacyDeleteResult> {
        const event = await this.d.eventRepository.findById(id);
        if (!event) throw sessionErrors.eventNotFound();
        if (event.status === "DRAFT") {
            await this.d.eventRepository.deleteDraft(id);
            await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.deleted", entity: "CalendarEvent", entityId: id, oldValue: { title: event.title, startDate: day(event.startDate), status: "DRAFT" } });
            return { deleted: true, title: event.title };
        }
        // Published: cancelled, not erased (the cancel use case is idempotent for an already cancelled event). No notification from this route.
        await this.d.cancelEventUseCase.execute(schoolId, id, actor, { via: "legacy_delete" });
        return { deleted: true, title: event.title, cancelled: true, status: "CANCELLED" };
    }
}
