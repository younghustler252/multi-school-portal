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

// ── Create subject ────────────────────────────────────────────────────────
export const CreateSubjectDto = z.object({
    name:        z.string().min(1).max(100),
    code:        z.string().optional(),
    description: z.string().optional(),
});

// ── Update subject ────────────────────────────────────────────────────────
export const UpdateSubjectDto = z.object({
    name:        z.string().min(1).max(100).optional(),
    code:        z.string().optional(),
    description: z.string().optional(),
});

export const AssignSubjectDto = z.object({
    subjectId: z.string().uuid(),
    staffId:   z.string().uuid(),
    termId:    z.string().uuid(),
});

// ── Bulk assign subjects to class ─────────────────────────────────────────
export const BulkAssignSubjectsDto = z.object({
    staffId: z.uuid(),
    termId: z.uuid(),
    subjectIds: z.array(z.uuid()).min(1),
});

export const SetSubjectDefaultTeacherDto = z.object({
	staffId: z.uuid().nullable(),
});




// ── Update class subject assignment ───────────────────────────────────────
export const UpdateClassSubjectDto = z.object({
    staffId: z.string().uuid(),
});

export type CreateClassDtoType         = z.infer<typeof CreateClassDto>;
export type UpdateClassDtoType         = z.infer<typeof UpdateClassDto>;
export type SetClassTeacherDtoType     = z.infer<typeof SetClassTeacherDto>;
export type SetClassProgressionDtoType = z.infer<typeof SetClassProgressionDto>;
export type CreateSubjectDtoType       = z.infer<typeof CreateSubjectDto>;
export type UpdateSubjectDtoType       = z.infer<typeof UpdateSubjectDto>;
export type AssignSubjectDtoType       = z.infer<typeof AssignSubjectDto>;
export type BulkAssignSubjectsDtoType  = z.infer<typeof BulkAssignSubjectsDto>;
export type UpdateClassSubjectDtoType  = z.infer<typeof UpdateClassSubjectDto>;
export type SetSubjectDefaultTeacherDtoType = z.infer<typeof SetSubjectDefaultTeacherDto>;
