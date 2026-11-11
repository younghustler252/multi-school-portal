import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { IBranchRepository } from "../../branches/repositories/branch.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { IEventRepository } from "../repositories/event.repository";
import { EventMapper, EventResponseData } from "../mappers/event.mapper";
import { CalendarEventEntity } from "../domain/event.entity";
import { eventErrors } from "../domain/event.errors";
import { assertAudience, assertSchedule, normaliseKinds, normaliseReminderOffsets, scheduleChanged } from "../domain/event.policy";
import { assertCanActOnEvent, audienceScope, seesEveryEvent } from "../domain/event.scope";
import { CreateEventDtoType, ListEventsQueryType, UpdateEventDtoType } from "../dtos/event.dto";
import { nameLookup } from "./event-presenter";

export interface EventActor { userId: string }
interface Deps {
    eventRepository: IEventRepository; sessionRepository: ISessionRepository; branchRepository: Pick<IBranchRepository, "findMany">;
    classRepository: Pick<IClassRepository, "findAllClasses">; eventMapper: EventMapper; auditService: AuditService;
}
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x));

async function present(d: Deps, events: CalendarEventEntity[]): Promise<EventResponseData[]> {
    const names = await nameLookup(d.sessionRepository, events);
    return events.map(e => { const n = names(e); return d.eventMapper.toResponse(e, n.term, n.session); });
}

/*
| WHO SEES WHICH EVENT, for now. People who manage events see everything (drafts too).
| Everyone else sees published and cancelled events that are meant for the whole school. (Audience-specific
| visibility for students, parents and staff arrives with the viewer matcher in the next step; until then
| an event aimed at a smaller group is simply not shown to people outside the managers, never shown wrongly.)
*/
export const isVisibleToViewer = (e: CalendarEventEntity, access: Access | undefined): boolean => {
    if (seesEveryEvent(access)) return true;
    return e.status !== "DRAFT" && e.audienceKinds.includes("EVERYONE") && e.branchIds.length === 0 && e.classIds.length === 0;
};

export class ListEventsUseCase {
    constructor(private readonly d: Deps) {}
    async execute(q: ListEventsQueryType, access?: Access): Promise<EventResponseData[]> {
        const where: Record<string, any> = {};
        const manager = seesEveryEvent(access);
        if (manager) { if (q.status) where.status = q.status; } else where.status = { in: ["PUBLISHED", "CANCELLED"] };
        if (q.termId) where.termId = q.termId;
        if (q.sessionId) where.sessionId = q.sessionId;
        if (q.type) where.type = q.type;
        const and: Record<string, any>[] = [];
        if (q.to) and.push({ startDate: { lte: new Date(q.to) } });
        if (q.from) and.push({ OR: [{ endDate: { gte: new Date(q.from) } }, { endDate: null, startDate: { gte: new Date(q.from) } }] });
        if (and.length) where.AND = and;
        const events = (await this.d.eventRepository.findMany(where)).filter(e => isVisibleToViewer(e, access));
        return present(this.d, events);
    }
}

export class GetEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(id: string, access?: Access): Promise<EventResponseData> {
        const event = await this.d.eventRepository.findById(id);
        if (!event || !isVisibleToViewer(event, access)) throw eventErrors.notFound();    // 404, never "forbidden": it does not reveal that the event exists
        return (await present(this.d, [event]))[0];
    }
}

/* Checks that the chosen branches and classes exist and fit together. Returns the class → branch map. */
async function checkAudienceTargets(d: Deps, branchIds: string[], classIds: string[]): Promise<Map<string, string>> {
    if (branchIds.length) {
        const found = await d.branchRepository.findMany({ id: { in: branchIds } });
        if (found.length !== new Set(branchIds).size) throw eventErrors.branchNotFound();
    }
    const classBranch = new Map<string, string>();
    if (classIds.length) {
        const all = await d.classRepository.findAllClasses();
        const byId = new Map(all.map(c => [c.id, c.branchId]));
        for (const id of classIds) { const b = byId.get(id); if (!b) throw eventErrors.classNotFound(); classBranch.set(id, b); }
        if (branchIds.length && [...classBranch.values()].some(b => !branchIds.includes(b))) throw eventErrors.classOutsideBranches();
    }
    return classBranch;
}

/* CREATE. Always a DRAFT: nothing is announced and nobody sees it until it is published. */
export class CreateEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, dto: CreateEventDtoType, actor: EventActor, access?: Access): Promise<EventResponseData> {
        const { sessionRepository: sessions } = this.d;
        let sessionId: string | null = dto.sessionId ?? null;
        if (dto.termId) {
            const term = await sessions.findTermById(dto.termId);
            if (!term) throw eventErrors.termNotFound();
            if (sessionId && sessionId !== term.sessionId) throw eventErrors.badScope();
            sessionId = term.sessionId;
        }
        if (sessionId && !(await sessions.findSessionById(sessionId))) throw eventErrors.sessionNotFound();

        const kinds = normaliseKinds(dto.audienceKinds);
        const startDate = new Date(dto.startDate), endDate = dto.endDate ? new Date(dto.endDate) : null;
        const startTime = dto.isAllDay ? null : dto.startTime ?? null, endTime = dto.isAllDay ? null : dto.endTime ?? null;
        assertSchedule({ startDate, endDate, isAllDay: dto.isAllDay, startTime: dto.startTime ?? null, endTime: dto.endTime ?? null });
        const isHoliday = dto.type === "holiday" || !!dto.isHoliday;

        const classBranch = await checkAudienceTargets(this.d, dto.branchIds ?? [], dto.classIds ?? []);
        const scope = audienceScope(access, "events.manage", { audienceKinds: kinds, branchIds: dto.branchIds, classIds: dto.classIds }, classBranch);
        assertAudience({ audienceKinds: kinds, branchIds: scope.branchIds, classIds: scope.classIds, isHoliday });
        const offsets = normaliseReminderOffsets(dto.reminderOffsetsMinutes);

        const created = await this.d.eventRepository.create({
            data: {
                title: dto.title, description: dto.description ?? null, type: dto.type, isHoliday, status: "DRAFT",
                startDate, endDate, isAllDay: dto.isAllDay, startTime, endTime, location: dto.location ?? null,
                termId: dto.termId ?? null, sessionId, audienceKinds: kinds, notifyChannels: [...new Set(dto.notifyChannels)],
                reminderOffsetsMinutes: offsets, createdById: actor.userId, updatedById: actor.userId,
            },
            branchIds: scope.branchIds, classIds: scope.classIds,
        });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.created", entity: "CalendarEvent", entityId: created.id, newValue: { title: dto.title, type: dto.type, startDate: dto.startDate, status: "DRAFT" } });
        return (await present(this.d, [created]))[0];
    }
}

/* UPDATE. A cancelled event is frozen. The audience of a published event is locked (people were already told). Only changed fields are written. */
export class UpdateEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, dto: UpdateEventDtoType, actor: EventActor, access?: Access): Promise<EventResponseData> {
        const event = await this.d.eventRepository.findById(id);
        if (!event) throw eventErrors.notFound();
        assertCanActOnEvent(access, "events.manage", event);
        if (event.status === "CANCELLED") throw eventErrors.cancelled();
        const published = event.status === "PUBLISHED";

        const isAllDay = dto.isAllDay ?? event.isAllDay;
        const startDate = dto.startDate ? new Date(dto.startDate) : event.startDate;
        const endDate = dto.endDate === undefined ? event.endDate : dto.endDate ? new Date(dto.endDate) : null;
        // Switching to all-day clears the times unless the caller (wrongly) sends some, which is then refused
        const startTime = dto.startTime !== undefined ? dto.startTime : dto.isAllDay === true ? null : event.startTime;
        const endTime = dto.endTime !== undefined ? dto.endTime : dto.isAllDay === true ? null : event.endTime;
        const next = { startDate, endDate, isAllDay, startTime, endTime };
        assertSchedule(next);

        const type = dto.type ?? event.type;
        const isHoliday = type === "holiday" || (dto.isHoliday ?? event.isHoliday);
        const kinds = dto.audienceKinds ? normaliseKinds(dto.audienceKinds) : event.audienceKinds;
        const audienceGiven = dto.audienceKinds !== undefined || dto.branchIds !== undefined || dto.classIds !== undefined;
        let branchIds = event.branchIds, classIds = event.classIds, audienceChanged = false;
        if (audienceGiven) {
            const wantBranches = dto.branchIds ?? event.branchIds, wantClasses = dto.classIds ?? event.classIds;
            const classBranch = await checkAudienceTargets(this.d, wantBranches, wantClasses);
            const scope = audienceScope(access, "events.manage", { audienceKinds: kinds, branchIds: wantBranches, classIds: wantClasses }, classBranch);
            audienceChanged = !sameSet(kinds, event.audienceKinds) || !sameSet(scope.branchIds, event.branchIds) || !sameSet(scope.classIds, event.classIds);
            if (audienceChanged && published) throw eventErrors.audienceLocked();
            branchIds = scope.branchIds; classIds = scope.classIds;
        }
        assertAudience({ audienceKinds: kinds, branchIds, classIds, isHoliday });

        const data: Record<string, unknown> = {}, before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        const set = (k: string, now: unknown, was: unknown) => { if (JSON.stringify(now) !== JSON.stringify(was)) { data[k] = now; before[k] = was; after[k] = now; } };
        if (dto.title !== undefined) set("title", dto.title, event.title);
        if (dto.description !== undefined) set("description", dto.description, event.description);
        set("type", type, event.type);
        set("isHoliday", isHoliday, event.isHoliday);
        if (dto.location !== undefined) set("location", dto.location, event.location);
        if (dto.notifyChannels !== undefined) set("notifyChannels", [...new Set(dto.notifyChannels)], event.notifyChannels);
        if (dto.reminderOffsetsMinutes !== undefined) set("reminderOffsetsMinutes", normaliseReminderOffsets(dto.reminderOffsetsMinutes), event.reminderOffsetsMinutes);
        if (audienceChanged) set("audienceKinds", kinds, event.audienceKinds);
        const rescheduled = scheduleChanged(event, next);
        if (rescheduled) {
            data.startDate = startDate; data.endDate = endDate; data.isAllDay = isAllDay; data.startTime = isAllDay ? null : startTime; data.endTime = isAllDay ? null : endTime;
            before.schedule = { startDate: day(event.startDate), endDate: day(event.endDate), isAllDay: event.isAllDay, startTime: event.startTime, endTime: event.endTime };
            after.schedule = { startDate: day(startDate), endDate: day(endDate), isAllDay, startTime: isAllDay ? null : startTime, endTime: isAllDay ? null : endTime };
            // Reminders belong to a revision of the schedule: a published event that moves starts a new one
            if (published) data.revision = event.revision + 1;
        }
        if (Object.keys(data).length === 0 && !audienceChanged) return (await present(this.d, [event]))[0];

        data.updatedById = actor.userId;
        const updated = await this.d.eventRepository.update(id, { data, ...(audienceChanged ? { branchIds, classIds } : {}) });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: published && rescheduled ? "calendar_event.rescheduled" : "calendar_event.updated", entity: "CalendarEvent", entityId: id, oldValue: before, newValue: after });
        return (await present(this.d, [updated]))[0];
    }
}

/* DELETE: drafts only. A published event is cancelled instead, so its history is kept. */
export class DeleteEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, actor: EventActor, access?: Access): Promise<{ deleted: true; title: string }> {
        const event = await this.d.eventRepository.findById(id);
        if (!event) throw eventErrors.notFound();
        assertCanActOnEvent(access, "events.manage", event);
        if (event.status !== "DRAFT") throw eventErrors.notDraft();
        await this.d.eventRepository.deleteDraft(id);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.deleted", entity: "CalendarEvent", entityId: id, oldValue: { title: event.title, startDate: day(event.startDate), status: "DRAFT" } });
        return { deleted: true, title: event.title };
    }
}

/*
| CANCEL (published → cancelled). Idempotent: cancelling a cancelled event changes nothing and returns it.
| A draft cannot be cancelled (delete it). Notices to the audience are added with the lifecycle step; this use case only changes the state.
*/
export class CancelEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, actor: EventActor, opts: { reason?: string | null; via?: string; access?: Access } = {}): Promise<{ event: CalendarEventEntity; changed: boolean }> {
        const event = await this.d.eventRepository.findById(id);
        if (!event) throw eventErrors.notFound();
        assertCanActOnEvent(opts.access, "events.manage", event);
        if (event.status === "CANCELLED") return { event, changed: false };
        if (event.status !== "PUBLISHED") throw eventErrors.notPublished();
        const updated = await this.d.eventRepository.update(id, { data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: actor.userId, cancelReason: opts.reason ?? null, updatedById: actor.userId } });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.cancelled", entity: "CalendarEvent", entityId: id, oldValue: { status: "PUBLISHED" }, newValue: { status: "CANCELLED", ...(opts.via ? { via: opts.via } : {}), ...(opts.reason ? { reason: opts.reason } : {}) } });
        return { event: updated, changed: true };
    }
}
