import { IMapper } from "../../../infrastructure/repository/base.repository";
import { CalendarEventEntity } from "../domain/event.entity";

// An event shows its term and session by NAME ({ id, name }), not by bare ids. `null` = the whole school.
export interface NameRef { id: string; name: string }

export interface EventResponseData {
    id: string; title: string; description: string | null; type: string; status: string; isHoliday: boolean;
    startDate: Date; endDate: Date | null; isAllDay: boolean; startTime: string | null; endTime: string | null; location: string | null; coverImageUrl: string | null;
    term: NameRef | null; session: NameRef | null;
    audience: { kinds: string[]; branchIds: string[]; classIds: string[] };
    notifyChannels: string[]; reminderOffsetsMinutes: number[]; revision: number;
    publishedAt: Date | null; cancelledAt: Date | null; cancelReason: string | null;
    createdAt: Date; updatedAt: Date;
}

/** The response of the OLD Sessions calendar routes: exactly the fields they always had. */
export interface LegacyCalendarEventResponseData {
    id: string; title: string; description: string | null; startDate: Date; endDate: Date | null; type: string; isHoliday: boolean;
    term: NameRef | null; session: NameRef | null; createdAt: Date;
}

export class EventMapper implements IMapper<any, CalendarEventEntity> {
    toDomain(raw: any): CalendarEventEntity {
        return {
            id: raw.id, termId: raw.termId ?? null, sessionId: raw.sessionId ?? null, title: raw.title,
            description: raw.description ?? null, startDate: raw.startDate, endDate: raw.endDate ?? null,
            type: raw.type, isHoliday: raw.isHoliday, createdById: raw.createdById ?? null,
            createdAt: raw.createdAt, updatedAt: raw.updatedAt,
            status: raw.status ?? "PUBLISHED", isAllDay: raw.isAllDay ?? true, startTime: raw.startTime ?? null, endTime: raw.endTime ?? null,
            location: raw.location ?? null, coverImageUrl: raw.coverImageUrl ?? null,
            audienceKinds: raw.audienceKinds ?? ["EVERYONE"],
            branchIds: (raw.branches ?? []).map((b: any) => b.branchId), classIds: (raw.classes ?? []).map((c: any) => c.classId),
            notifyChannels: raw.notifyChannels ?? [], reminderOffsetsMinutes: raw.reminderOffsetsMinutes ?? [],
            revision: raw.revision ?? 1, publishedAt: raw.publishedAt ?? null, publishedById: raw.publishedById ?? null,
            publishNoticeSentAt: raw.publishNoticeSentAt ?? null, cancelledAt: raw.cancelledAt ?? null,
            cancelledById: raw.cancelledById ?? null, cancelReason: raw.cancelReason ?? null, updatedById: raw.updatedById ?? null,
        };
    }

    toResponse(e: CalendarEventEntity, term: NameRef | null = null, session: NameRef | null = null): EventResponseData {
        return {
            id: e.id, title: e.title, description: e.description, type: e.type, status: e.status, isHoliday: e.isHoliday,
            startDate: e.startDate, endDate: e.endDate, isAllDay: e.isAllDay, startTime: e.startTime, endTime: e.endTime, location: e.location, coverImageUrl: e.coverImageUrl,
            term, session,
            audience: { kinds: e.audienceKinds, branchIds: e.branchIds, classIds: e.classIds },
            notifyChannels: e.notifyChannels, reminderOffsetsMinutes: e.reminderOffsetsMinutes, revision: e.revision,
            publishedAt: e.publishedAt, cancelledAt: e.cancelledAt, cancelReason: e.cancelReason,
            createdAt: e.createdAt, updatedAt: e.updatedAt,
        };
    }

    toLegacyResponse(e: CalendarEventEntity, term: NameRef | null = null, session: NameRef | null = null): LegacyCalendarEventResponseData {
        return {
            id: e.id, title: e.title, description: e.description, startDate: e.startDate, endDate: e.endDate,
            type: e.type, isHoliday: e.isHoliday, term, session, createdAt: e.createdAt,
        };
    }
}
