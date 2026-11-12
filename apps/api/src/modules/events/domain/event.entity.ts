import type { EventTypeRef } from "./event-type.entity";

export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED"] as const;
export type EventStatus = typeof EVENT_STATUSES[number];

export const EVENT_AUDIENCE_KINDS = ["EVERYONE", "TEACHING_STAFF", "NON_TEACHING_STAFF", "STUDENTS", "GUARDIANS"] as const;
export type EventAudienceKind = typeof EVENT_AUDIENCE_KINDS[number];

export const EVENT_TYPES = ["holiday", "event", "exam", "break", "other", "meeting", "sports", "ceremony", "graduation", "resumption", "pta"] as const;
export const NOTIFY_CHANNELS = ["IN_APP", "EMAIL", "SMS"] as const;
export type NotifyChannel = typeof NOTIFY_CHANNELS[number];

export interface CalendarEventEntity {
    id:          string;
    termId:      string | null;
    sessionId:   string | null;
    title:       string;
    description: string | null;
    startDate:   Date;
    endDate:     Date | null;
    type:        string;            // the legacy enum mirror, kept in step by the database; custom types show as "other"
    eventTypeId: string | null;
    eventType:   EventTypeRef | null;   // the event's real type (system or custom)
    isHoliday:   boolean;            // derived by the database: true exactly for the system holiday type
    createdById: string | null;
    createdAt:   Date;
    updatedAt:   Date;

    status:         EventStatus;
    isAllDay:       boolean;
    startTime:      string | null;     // "HH:mm" in the school's time zone; null when all-day
    endTime:        string | null;
    location:       string | null;
    coverImageUrl:  string | null;
    audienceKinds:  EventAudienceKind[];
    branchIds:      string[];          // audience narrowing (empty = no branch narrowing)
    classIds:       string[];
    notifyChannels: NotifyChannel[];
    reminderOffsetsMinutes: number[];
    revision:       number;
    publishedAt:    Date | null;
    publishedById:  string | null;
    publishNoticeSentAt: Date | null;
    cancelledAt:    Date | null;
    cancelledById:  string | null;
    cancelReason:   string | null;
    updatedById:    string | null;
}
