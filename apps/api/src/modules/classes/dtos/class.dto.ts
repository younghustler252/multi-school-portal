import { z } from "zod";

/*
|--------------------------------------------------------------------------
| CLASS + SUBJECT DTOs
|--------------------------------------------------------------------------
*/

// ── Create class ──────────────────────────────────────────────────────────
// Strict (unknown fields are rejected); text is trimmed; a blank value counts as "not sent" (create) or "clear it" (update).
const blank = (to: undefined | null) => (v: unknown) => (typeof v === "string" && v.trim() === "" ? to : v);
const capacity = z.number().int().min(1).max(500);

export const CreateClassDto = z.object({
    name:     z.string().trim().min(1).max(50),
    level:    z.preprocess(blank(undefined), z.string().trim().max(30).optional()),
    capacity: capacity.optional(),
}).strict();

// ── Update class (send only what changes; null or "" clears level, null clears capacity) ──
export const UpdateClassDto = z.object({
    name:     z.string().trim().min(1).max(50).optional(),
    level:    z.preprocess(blank(null), z.string().trim().max(30).nullable().optional()),
    capacity: capacity.nullable().optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change");

// ── Class teacher and progression ─────────────────────────────────────────
export const SetClassTeacherDto = z.object({ staffId: z.string().uuid().nullable() }).strict();
export const SetClassProgressionDto = z.object({ toClassId: z.string().uuid().nullable() }).strict();   // null = the class graduates

// ── Subjects ──────────────────────────────────────────────────────────────
// Codes are saved in capitals ("math" and "MATH" are the same code).
const subjectCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{0,19}$/, "Use letters, numbers, - or _ (up to 20 characters)");

export const CreateSubjectDto = z.object({
    name:        z.string().trim().min(1).max(100),
    code:        z.preprocess(blank(undefined), subjectCode.optional()),
    description: z.preprocess(blank(undefined), z.string().trim().max(300).optional()),
}).strict();

export const UpdateSubjectDto = z.object({
    name:        z.string().trim().min(1).max(100).optional(),
    code:        z.preprocess(blank(null), subjectCode.nullable().optional()),
    description: z.preprocess(blank(null), z.string().trim().max(300).nullable().optional()),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change");

export const SetSubjectDefaultTeacherDto = z.object({ staffId: z.string().uuid().nullable() }).strict();

// ── Who teaches a subject in a class, for a term ──────────────────────────
export const AssignSubjectDto = z.object({
    subjectId: z.string().uuid(),
    staffId:   z.string().uuid(),
    termId:    z.string().uuid(),
}).strict();

// One teacher for several subjects at once (at most 50 per request)
export const BulkAssignSubjectsDto = z.object({
    staffId:    z.string().uuid(),
    termId:     z.string().uuid(),
    subjectIds: z.array(z.string().uuid()).min(1).max(50),
}).strict();

export type CreateClassDtoType         = z.infer<typeof CreateClassDto>;
export type UpdateClassDtoType         = z.infer<typeof UpdateClassDto>;
export type SetClassTeacherDtoType     = z.infer<typeof SetClassTeacherDto>;
export type SetClassProgressionDtoType = z.infer<typeof SetClassProgressionDto>;
export type CreateSubjectDtoType       = z.infer<typeof CreateSubjectDto>;
export type UpdateSubjectDtoType       = z.infer<typeof UpdateSubjectDto>;
export type AssignSubjectDtoType       = z.infer<typeof AssignSubjectDto>;
export type BulkAssignSubjectsDtoType  = z.infer<typeof BulkAssignSubjectsDto>;
export type SetSubjectDefaultTeacherDtoType = z.infer<typeof SetSubjectDefaultTeacherDto>;
