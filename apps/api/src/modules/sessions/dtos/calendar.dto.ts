import { z } from "zod";
import { parseDate } from "../domain/session.policy";

/* CALENDAR DTOs. Strict. An event belongs to a term OR a session (a term already implies its session) or to neither (whole school). */
const date = z.string().trim().refine(v => parseDate(v) !== null, "Enter a valid date");
const EVENT_TYPES = ["holiday", "event", "exam", "break", "other"] as const;
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const endNotBefore = (o: { startDate?: string; endDate?: string | null }) =>
    !o.startDate || !o.endDate || new Date(o.endDate).getTime() >= new Date(o.startDate).getTime();
const NOT_BEFORE = { message: "The end date cannot be before the start date", path: ["endDate"] };

export const CreateCalendarEventDto = z.object({
    title:       z.string().trim().min(1).max(120),
    description: z.preprocess(blank, z.string().trim().max(500).optional()),
    startDate:   date,
    endDate:     z.preprocess(blank, date.optional()),
    type:        z.enum(EVENT_TYPES).default("event"),
    isHoliday:   z.boolean().optional(),            // a "holiday" event is always a holiday
    termId:      z.string().uuid().optional(),
    sessionId:   z.string().uuid().optional(),
}).strict().refine(endNotBefore, NOT_BEFORE);

export const UpdateCalendarEventDto = z.object({
    title:       z.string().trim().min(1).max(120).optional(),
    description: z.preprocess(v => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(500).nullable().optional()),
    startDate:   date.optional(),
    endDate:     z.preprocess(v => (typeof v === "string" && v.trim() === "" ? null : v), date.nullable().optional()),
    type:        z.enum(EVENT_TYPES).optional(),
    isHoliday:   z.boolean().optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change").refine(endNotBefore, NOT_BEFORE);

export const ListCalendarEventsQuery = z.object({
    termId:    z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    type:      z.enum(EVENT_TYPES).optional(),
    from:      date.optional(),
    to:        date.optional(),
});

export type CreateCalendarEventDtoType = z.infer<typeof CreateCalendarEventDto>;
export type UpdateCalendarEventDtoType = z.infer<typeof UpdateCalendarEventDto>;
export type ListCalendarEventsQueryType = z.infer<typeof ListCalendarEventsQuery>;
