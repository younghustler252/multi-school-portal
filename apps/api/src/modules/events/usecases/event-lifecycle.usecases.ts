import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import { ISchoolRepository } from "../../school/repositories/school.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { IEventRepository } from "../repositories/event.repository";
import { EventMapper, EventResponseData } from "../mappers/event.mapper";
import { CalendarEventEntity } from "../domain/event.entity";
import { eventErrors } from "../domain/event.errors";
import { assertSchedule, scheduleChanged } from "../domain/event.policy";
import { assertCanActOnEvent } from "../domain/event.scope";
import { NOTICE_STATUS, NoticeKind, hasStarted } from "../domain/event.notice";
import { RescheduleEventDtoType, CancelEventDtoType } from "../dtos/event.dto";
import { EventReminderService } from "../services/event-reminder.service";
import { EventNoticeService, NoticeOutcome } from "../services/event-notice.service";
import { CancelEventUseCase, EventActor } from "./events.usecases";
import { nameLookup } from "./event-presenter";

export type LifecycleNotice = NoticeOutcome | { sent: false; reason: "already_started" } | null;
interface Deps {
    eventRepository: IEventRepository; schoolRepository: Pick<ISchoolRepository, "findById">; sessionRepository: ISessionRepository;
    eventMapper: EventMapper; auditService: AuditService; eventNoticeService: EventNoticeService; eventReminderService: EventReminderService; cancelEventUseCase: CancelEventUseCase;
}
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function timeZoneOf(d: Deps, schoolId: string): Promise<string> { return (await d.schoolRepository.findById(schoolId))?.timezone || "UTC"; }
async function present(d: Deps, e: CalendarEventEntity): Promise<EventResponseData> {
    const n = (await nameLookup(d.sessionRepository, [e]))(e);
    return d.eventMapper.toResponse(e, n.term, n.session);
}
const load = async (d: Deps, id: string) => { const e = await d.eventRepository.findById(id); if (!e) throw eventErrors.notFound(); return e; };

/* PUBLISH (draft → published). Needs events.publish. Publishing again changes nothing. Tells the audience only when the school has notices on and the event has not started. */
export class PublishEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, actor: EventActor, access?: Access): Promise<{ event: EventResponseData; changed: boolean; notice: LifecycleNotice }> {
        const event = await load(this.d, id);
        assertCanActOnEvent(access, "events.publish", event);
        if (event.status === "CANCELLED") throw eventErrors.cancelled();
        if (event.status === "PUBLISHED") return { event: await present(this.d, event), changed: false, notice: null };

        const published = await this.d.eventRepository.update(id, { data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: actor.userId, updatedById: actor.userId } });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "calendar_event.published", entity: "CalendarEvent", entityId: id, oldValue: { status: "DRAFT" }, newValue: { status: "PUBLISHED" } });
        await this.d.eventReminderService.sync(schoolId, published);
        const started = hasStarted(published, new Date(), await timeZoneOf(this.d, schoolId));
        const notice: LifecycleNotice = started ? { sent: false, reason: "already_started" } : await this.d.eventNoticeService.send(schoolId, published, "published", actor.userId);
        return { event: await present(this.d, await this.d.eventRepository.findById(id) ?? published), changed: true, notice };
    }
}

/* RESCHEDULE (published only). Needs events.publish. A real change starts a new revision (reminders and notices belong to a revision). */
export class RescheduleEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, dto: RescheduleEventDtoType, actor: EventActor, access?: Access): Promise<{ event: EventResponseData; changed: boolean; notice: LifecycleNotice }> {
        const event = await load(this.d, id);
        assertCanActOnEvent(access, "events.publish", event);
        if (event.status === "CANCELLED") throw eventErrors.cancelled();
        if (event.status !== "PUBLISHED") throw eventErrors.notPublished();

        const next = { startDate: new Date(dto.startDate), endDate: dto.endDate ? new Date(dto.endDate) : null, isAllDay: dto.isAllDay, startTime: dto.isAllDay ? null : dto.startTime ?? null, endTime: dto.isAllDay ? null : dto.endTime ?? null };
        assertSchedule({ ...next, startTime: dto.startTime ?? null, endTime: dto.endTime ?? null });
        if (!scheduleChanged(event, next)) return { event: await present(this.d, event), changed: false, notice: null };

        const updated = await this.d.eventRepository.update(id, { data: { ...next, revision: event.revision + 1, updatedById: actor.userId } });
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "calendar_event.rescheduled", entity: "CalendarEvent", entityId: id,
            oldValue: { startDate: day(event.startDate), endDate: day(event.endDate), isAllDay: event.isAllDay, startTime: event.startTime, endTime: event.endTime },
            newValue: { startDate: day(next.startDate), endDate: day(next.endDate), isAllDay: next.isAllDay, startTime: next.startTime, endTime: next.endTime, revision: updated.revision },
        });
        await this.d.eventReminderService.sync(schoolId, updated);          // the old revision's pending reminders are cancelled, the new ones planned
        // The old date may already have passed: the notice is about the NEW start, so it is judged on that
        const notice: LifecycleNotice = hasStarted(updated, new Date(), await timeZoneOf(this.d, schoolId)) ? { sent: false, reason: "already_started" } : await this.d.eventNoticeService.send(schoolId, updated, "rescheduled", actor.userId);
        return { event: await present(this.d, updated), changed: true, notice };
    }
}

/* CANCEL route (published → cancelled). Needs events.publish; tells the audience (when notices are on). */
export class CancelPublishedEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, dto: CancelEventDtoType, actor: EventActor, access?: Access): Promise<{ event: EventResponseData; changed: boolean; notice: LifecycleNotice }> {
        const event = await load(this.d, id);
        assertCanActOnEvent(access, "events.publish", event);
        const out = await this.d.cancelEventUseCase.execute(schoolId, id, actor, { reason: dto.reason ?? null, access, notify: true });
        return { event: await present(this.d, out.event), changed: out.changed, notice: out.notice };
    }
}

/*
| NOTIFY (manual). Needs events.publish. Sends one of the three notices for an event in the matching state, once per person and channel
| (repeating it sends nothing new). Refused when notices are off, or after the event has started.
| This is how a school catches up after switching notices on: they are never sent retroactively on their own.
*/
export class NotifyEventUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, kind: NoticeKind, actor: EventActor, access?: Access): Promise<NoticeOutcome> {
        const event = await load(this.d, id);
        assertCanActOnEvent(access, "events.publish", event);
        if (event.status !== NOTICE_STATUS[kind] || (kind === "rescheduled" && event.revision < 2)) throw eventErrors.noticeMismatch(kind);
        if (hasStarted(event, new Date(), await timeZoneOf(this.d, schoolId))) throw eventErrors.alreadyStarted();
        if (!(await this.d.eventNoticeService.enabled())) throw eventErrors.noticesOff();
        return this.d.eventNoticeService.send(schoolId, event, kind, actor.userId);
    }
}

/* AUDIENCE PREVIEW: how many people the event reaches, so a manager can check before publishing. Needs events.manage. */
export class PreviewEventAudienceUseCase {
    constructor(private readonly d: Deps) {}
    async execute(id: string, access?: Access) {
        const event = await load(this.d, id);
        assertCanActOnEvent(access, "events.manage", event);
        return { audience: { kinds: event.audienceKinds, branchIds: event.branchIds, classIds: event.classIds }, ...(await this.d.eventNoticeService.preview(event)) };
    }
}
