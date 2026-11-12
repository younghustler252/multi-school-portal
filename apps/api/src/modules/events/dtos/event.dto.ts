import { z } from "zod";
import { NOTICE_KINDS } from "../domain/event.notice";
import { EVENT_AUDIENCE_KINDS, EVENT_STATUSES, NOTIFY_CHANNELS } from "../domain/event.entity";
import { HM, MAX_REMINDERS, MAX_REMINDER_MINUTES, MIN_REMINDER_MINUTES } from "../domain/event.policy";

/* EVENT DTOs. Strict. There is NO field for recipients: who an event reaches is worked out by the server from the audience kinds, branches and classes. */
const date = z.string().trim().refine(v => !Number.isNaN(new Date(v).getTime()), "Enter a valid date");
const clearable = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const time = z.string().trim().regex(HM, "Use 24-hour time, for example 09:30");
const offsets = z.array(z.number().int().min(MIN_REMINDER_MINUTES).max(MAX_REMINDER_MINUTES)).max(MAX_REMINDERS);
const kinds = z.array(z.enum(EVENT_AUDIENCE_KINDS)).min(1).max(EVENT_AUDIENCE_KINDS.length);
const typeKey = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use an event type key such as \"exam\"").min(2).max(40);
const ids = (max: number) => z.array(z.string().uuid()).max(max);

export const CreateEventDto = z.object({
    title:       z.string().trim().min(1).max(120),
    description: z.preprocess(clearable, z.string().trim().max(2000).nullable().optional()),
    type:        typeKey.optional(),                      // an event type KEY, system or custom. Default "event"
    eventTypeId: z.string().uuid().optional(),           // or the type's id. Send one of the two, not both
    startDate:   date,
    endDate:     z.preprocess(clearable, date.nullable().optional()),
    isAllDay:    z.boolean().default(true),
    startTime:   z.preprocess(clearable, time.nullable().optional()),
    endTime:     z.preprocess(clearable, time.nullable().optional()),
    location:    z.preprocess(clearable, z.string().trim().max(200).nullable().optional()),
    termId:      z.string().uuid().optional(),
    sessionId:   z.string().uuid().optional(),
    audienceKinds: kinds.default(["EVERYONE"]),
    branchIds:   ids(50).optional(),
    classIds:    ids(100).optional(),
    notifyChannels: z.array(z.enum(NOTIFY_CHANNELS)).max(3).default(["IN_APP"]),
    reminderOffsetsMinutes: offsets.default([]),
}).strict().refine(o => !(o.type && o.eventTypeId), { message: "Send the type or eventTypeId, not both", path: ["type"] });

export const UpdateEventDto = z.object({
    title:       z.string().trim().min(1).max(120).optional(),
    description: z.preprocess(clearable, z.string().trim().max(2000).nullable().optional()),
    type:        typeKey.optional(),
    eventTypeId: z.string().uuid().optional(),
    startDate:   date.optional(),
    endDate:     z.preprocess(clearable, date.nullable().optional()),
    isAllDay:    z.boolean().optional(),
    startTime:   z.preprocess(clearable, time.nullable().optional()),
    endTime:     z.preprocess(clearable, time.nullable().optional()),
    location:    z.preprocess(clearable, z.string().trim().max(200).nullable().optional()),
    audienceKinds: kinds.optional(),
    branchIds:   ids(50).optional(),
    classIds:    ids(100).optional(),
    notifyChannels: z.array(z.enum(NOTIFY_CHANNELS)).max(3).optional(),
    reminderOffsetsMinutes: offsets.optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change").refine(o => !(o.type && o.eventTypeId), { message: "Send the type or eventTypeId, not both", path: ["type"] });

export const ListEventsQuery = z.object({
    from:      date.optional(),
    to:        date.optional(),
    type:      typeKey.optional(),
    eventTypeId: z.string().uuid().optional(),
    termId:    z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    status:    z.enum(EVENT_STATUSES).optional(),         // managers only; everyone else sees published and cancelled events
});

export type CreateEventDtoType = z.infer<typeof CreateEventDto>;
export type UpdateEventDtoType = z.infer<typeof UpdateEventDto>;
export type ListEventsQueryType = z.infer<typeof ListEventsQuery>;

/* Lifecycle bodies. The date and time fields are the same rules as create: all-day or a start time. */
export const RescheduleEventDto = z.object({
    startDate: date,
    endDate:   z.preprocess(clearable, date.nullable().optional()),
    isAllDay:  z.boolean().default(true),
    startTime: z.preprocess(clearable, time.nullable().optional()),
    endTime:   z.preprocess(clearable, time.nullable().optional()),
}).strict();
export const CancelEventDto = z.object({ reason: z.preprocess(clearable, z.string().trim().max(500).nullable().optional()) }).strict();
export const NotifyEventDto = z.object({ kind: z.enum(NOTICE_KINDS as unknown as [string, ...string[]]) }).strict();
export type RescheduleEventDtoType = z.infer<typeof RescheduleEventDto>;
export type CancelEventDtoType = z.infer<typeof CancelEventDto>;
export type NotifyEventDtoType = { kind: "published" | "rescheduled" | "cancelled" };
