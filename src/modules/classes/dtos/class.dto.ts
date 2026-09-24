import { z } from "zod";

/*
|--------------------------------------------------------------------------
| CLASS + SUBJECT DTOs
|--------------------------------------------------------------------------
*/

// ── Create class ──────────────────────────────────────────────────────────
export const CreateClassDto = z.object({
    name:     z.string().min(1).max(50),
    level:    z.string().optional(),
    capacity: z.number().int().positive().optional(),
});

// ── Update class ──────────────────────────────────────────────────────────
export const UpdateClassDto = z.object({
    name:     z.string().min(1).max(50).optional(),
    level:    z.string().optional(),
    capacity: z.number().int().positive().optional(),
});

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
export type CreateSubjectDtoType       = z.infer<typeof CreateSubjectDto>;
export type UpdateSubjectDtoType       = z.infer<typeof UpdateSubjectDto>;
export type AssignSubjectDtoType       = z.infer<typeof AssignSubjectDto>;
export type BulkAssignSubjectsDtoType  = z.infer<typeof BulkAssignSubjectsDto>;
export type UpdateClassSubjectDtoType  = z.infer<typeof UpdateClassSubjectDto>;
export type SetSubjectDefaultTeacherDtoType = z.infer<typeof SetSubjectDefaultTeacherDto>;
