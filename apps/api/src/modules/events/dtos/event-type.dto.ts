import { z } from "zod";
import { COLOR_PATTERN, ICON_PATTERN, NAME_FORBIDDEN, NAME_MAX, NAME_MIN, cleanName } from "../domain/event-type.policy";

/* EVENT TYPE DTOs. Strict: unknown fields (key, isSystem, id ...) are refused, so they can never be set by a client. */
const clearable = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const name = z.string().transform(cleanName).pipe(z.string().min(NAME_MIN).max(NAME_MAX).refine(v => !NAME_FORBIDDEN.test(v), "The name cannot contain < > or control characters"));
const color = z.preprocess(clearable, z.string().regex(COLOR_PATTERN, "Use a colour like #1A73E8").nullable().optional());
const icon = z.preprocess(clearable, z.string().regex(ICON_PATTERN, "Use an icon id: lowercase letters, digits and hyphens").nullable().optional());

export const CreateEventTypeDto = z.object({ name, color, icon }).strict();

export const UpdateEventTypeDto = z.object({ name: name.optional(), color, icon, isActive: z.boolean().optional() })
    .strict().refine(o => Object.values(o).some(v => v !== undefined), "Send at least one field to change");

export const ListEventTypesQuery = z.object({
    includeInactive: z.enum(["true", "false"]).optional().transform(v => v === "true"),
}).strict();

export type CreateEventTypeDtoType = z.infer<typeof CreateEventTypeDto>;
export type UpdateEventTypeDtoType = z.infer<typeof UpdateEventTypeDto>;
export type ListEventTypesQueryType = z.infer<typeof ListEventTypesQuery>;
