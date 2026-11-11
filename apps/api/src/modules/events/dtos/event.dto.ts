import { z } from "zod";
import { EVENT_AUDIENCE_KINDS, EVENT_STATUSES, EVENT_TYPES, NOTIFY_CHANNELS } from "../domain/event.entity";
import { HM, MAX_REMINDERS, MAX_REMINDER_MINUTES, MIN_REMINDER_MINUTES } from "../domain/event.policy";

/* EVENT DTOs. Strict. There is NO field for recipients: who an event reaches is worked out by the server from the audience kinds, branches and classes. */
const date = z.string().trim().refine(v => !Number.isNaN(new Date(v).getTime()), "Enter a valid date");
const clearable = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const time = z.string().trim().regex(HM, "Use 24-hour time, for example 09:30");
const offsets = z.array(z.number().int().min(MIN_REMINDER_MINUTES).max(MAX_REMINDER_MINUTES)).max(MAX_REMINDERS);
const kinds = z.array(z.enum(EVENT_AUDIENCE_KINDS)).min(1).max(EVENT_AUDIENCE_KINDS.length);
const ids = (max: number) => z.array(z.string().uuid()).max(max);

export const CreateEventDto = z.object({
    title:       z.string().trim().min(1).max(120),
    description: z.preprocess(clearable, z.string().trim().max(2000).nullable().optional()),
    type:        z.enum(EVENT_TYPES).default("event"),
    startDate:   date,
    endDate:     z.preprocess(clearable, date.nullable().optional()),
    isAllDay:    z.boolean().default(true),
    startTime:   z.preprocess(clearable, time.nullable().optional()),
    endTime:     z.preprocess(clearable, time.nullable().optional()),
    location:    z.preprocess(clearable, z.string().trim().max(200).nullable().optional()),
    isHoliday:   z.boolean().optional(),                  // a "holiday" event is always a holiday
    termId:      z.string().uuid().optional(),
    sessionId:   z.string().uuid().optional(),
    audienceKinds: kinds.default(["EVERYONE"]),
    branchIds:   ids(50).optional(),
    classIds:    ids(100).optional(),
    notifyChannels: z.array(z.enum(NOTIFY_CHANNELS)).max(3).default(["IN_APP"]),
    reminderOffsetsMinutes: offsets.default([]),
}).strict();

export const UpdateEventDto = z.object({
    title:       z.string().trim().min(1).max(120).optional(),
    description: z.preprocess(clearable, z.string().trim().max(2000).nullable().optional()),
    type:        z.enum(EVENT_TYPES).optional(),
    startDate:   date.optional(),
    endDate:     z.preprocess(clearable, date.nullable().optional()),
    isAllDay:    z.boolean().optional(),
    startTime:   z.preprocess(clearable, time.nullable().optional()),
    endTime:     z.preprocess(clearable, time.nullable().optional()),
    location:    z.preprocess(clearable, z.string().trim().max(200).nullable().optional()),
    isHoliday:   z.boolean().optional(),
    audienceKinds: kinds.optional(),
    branchIds:   ids(50).optional(),
    classIds:    ids(100).optional(),
    notifyChannels: z.array(z.enum(NOTIFY_CHANNELS)).max(3).optional(),
    reminderOffsetsMinutes: offsets.optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change");

export const ListEventsQuery = z.object({
    from:      date.optional(),
    to:        date.optional(),
    type:      z.enum(EVENT_TYPES).optional(),
    termId:    z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    status:    z.enum(EVENT_STATUSES).optional(),         // managers only; everyone else sees published and cancelled events
});

export type CreateEventDtoType = z.infer<typeof CreateEventDto>;
export type UpdateEventDtoType = z.infer<typeof UpdateEventDto>;
export type ListEventsQueryType = z.infer<typeof ListEventsQuery>;
