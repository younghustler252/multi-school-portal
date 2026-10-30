import { z } from "zod";

/*
| PATCH /automations/:id   { "enabled": true, "channels": ["IN_APP","EMAIL"], "params": { "days_before": 3 }, "schedule": { "type": "daily", "time": "08:00" } }
| Every field is optional, at least one is needed. The numbers and the schedule are checked by the use case against the
| automation's own limits, so the error can say which one is wrong.
*/
export const UpdateAutomationDto = z.object({
    enabled:  z.boolean().optional(),
    channels: z.array(z.enum(["IN_APP", "EMAIL", "SMS"])).min(1).max(3).optional(),
    params:   z.record(z.string(), z.union([z.boolean(), z.number(), z.string().max(200)])).optional(),
    schedule: z.object({ type: z.enum(["daily", "weekly", "interval"]), weekday: z.number().int().optional(), time: z.string().max(5).optional(), minutes: z.number().int().optional() }).strict().optional(),
}).strict().refine(v => Object.keys(v).length > 0, { message: "Nothing to change" });

export type UpdateAutomationDtoType = z.infer<typeof UpdateAutomationDto>;
