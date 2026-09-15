import { z } from "zod";

/*
|--------------------------------------------------------------------------
| ENROLMENT DTOs
|--------------------------------------------------------------------------
*/

// ── Enrol student ─────────────────────────────────────────────────────────
export const EnrolStudentDto = z.object({
    studentId: z.string().uuid(),
    classId:   z.string().uuid(),
    termId:    z.string().uuid(),
});

// ── Bulk enrol students ───────────────────────────────────────────────────
export const BulkEnrolDto = z.object({
    studentIds: z.array(z.string().uuid()).min(1),
    classId:    z.string().uuid(),
    termId:     z.string().uuid(),
});

// ── Update enrolment status ───────────────────────────────────────────────
export const UpdateEnrolmentDto = z.object({
    status: z.enum(["active", "withdrawn", "transferred", "completed"]),
});

// ── List enrolments ───────────────────────────────────────────────────────
export const ListEnrolmentsDto = z.object({
    page:      z.string().optional(),
    limit:     z.string().optional(),
    classId:   z.string().optional(),
    termId:    z.string().optional(),
    studentId: z.string().optional(),
    status:    z.string().optional(),
});

// ── Promotion preview ─────────────────────────────────────────────────────
export const PromotionPreviewDto = z.object({
    termId: z.string().uuid(),
});
export const PromoteStudentsDto = z.object({
    currentTermId: z.string().uuid(),
    newTermId:     z.string().uuid(),
    rows: z.array(z.object({
        studentId:   z.string().uuid(),
        fromClassId: z.string().uuid(),
        toClassId:   z.string().uuid().nullable(),
    })).min(1),
    overrides: z.array(z.object({
        studentId: z.string().uuid(),
        action:    z.enum(["promote", "repeat", "graduate", "exclude"]),
        classId:   z.string().uuid().optional(),
    })).optional().default([]),
});

export type EnrolStudentDtoType =
    z.infer<typeof EnrolStudentDto>;

export type BulkEnrolDtoType =
    z.infer<typeof BulkEnrolDto>;

export type UpdateEnrolmentDtoType =
    z.infer<typeof UpdateEnrolmentDto>;

export type ListEnrolmentsDtoType =
    z.infer<typeof ListEnrolmentsDto>;

export type PromotionPreviewDtoType =
    z.infer<typeof PromotionPreviewDto>;

export type PromoteStudentsDtoType =
    z.infer<typeof PromoteStudentsDto>;
