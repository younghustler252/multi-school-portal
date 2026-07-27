import { z } from "zod";


export const CreateCalendarEventDto = z.object({
    title:       z.string().min(1).max(100),
    description: z.string().optional(),
    startDate:   z.string(),
    endDate:     z.string().optional(),
    type:        z.enum(["holiday", "event", "exam", "break", "other"])
                    .default("event"),
    isHoliday:   z.boolean().default(false),
    termId:      z.string().uuid().optional(),
    sessionId:   z.string().uuid().optional(),
    calendarId: z.string().uuid().optional(), //
});

export const ListCalendarEventsDto = z.object({
    termId:    z.string().optional(),
    sessionId: z.string().optional(),
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
    type:      z.string().optional(),
});

export type CreateCalendarEventDtoType = z.infer<typeof CreateCalendarEventDto>;
export type ListCalendarEventsDtoType  = z.infer<typeof ListCalendarEventsDto>;