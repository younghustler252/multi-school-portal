import { z } from "zod";
import { TERM_NAMES, isValidSessionName, parseDate } from "../domain/session.policy";

/* SESSION / TERM DTOs. Strict (unknown fields are rejected). Dates are "YYYY-MM-DD" or a full ISO date. */
const date = z.string().trim().refine(v => parseDate(v) !== null, "Enter a valid date");
const sessionName = z.string().trim().refine(isValidSessionName, "Use the form 2025/2026 (the second year follows the first)");
const termName = z.enum(TERM_NAMES);
const endAfterStart = (o: { startDate?: string; endDate?: string }) =>
    !o.startDate || !o.endDate || new Date(o.endDate).getTime() > new Date(o.startDate).getTime();
const AFTER = { message: "The end date must be after the start date", path: ["endDate"] };

export const CreateSessionDto = z.object({
    name: sessionName, startDate: date, endDate: date,
}).strict().refine(endAfterStart, AFTER);

export const UpdateSessionDto = z.object({
    name: sessionName.optional(), startDate: date.optional(), endDate: date.optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change").refine(endAfterStart, AFTER);

export const CreateTermDto = z.object({
    sessionId: z.string().uuid(), name: termName, startDate: date, endDate: date,
}).strict().refine(endAfterStart, AFTER);

// A term's name cannot change (records are saved against it); only its dates can
export const UpdateTermDto = z.object({
    startDate: date.optional(), endDate: date.optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change").refine(endAfterStart, AFTER);

// carryForward (default true): when this term becomes current, copy last term's student classes and subject
// teachers into it. Send false to switch the term without copying anything.
export const SetCurrentTermDto = z.object({ carryForward: z.boolean().default(true) }).strict().default({ carryForward: true });

export type CreateSessionDtoType   = z.infer<typeof CreateSessionDto>;
export type UpdateSessionDtoType   = z.infer<typeof UpdateSessionDto>;
export type CreateTermDtoType      = z.infer<typeof CreateTermDto>;
export type UpdateTermDtoType      = z.infer<typeof UpdateTermDto>;
export type SetCurrentTermDtoType  = z.infer<typeof SetCurrentTermDto>;
