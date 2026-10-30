import { z } from "zod";

/*
|--------------------------------------------------------------------------
| GRADE DTOs
|--------------------------------------------------------------------------
*/

// ── Enter grade ───────────────────────────────────────────────────────────
export const EnterGradeDto = z.object({
    studentId:      z.string().uuid(),
    termId:         z.string().uuid(),
    classSubjectId: z.string().uuid(),
    caScore:        z.number().min(0).max(100).optional(),
    examScore:      z.number().min(0).max(100).optional(),
});

// ── Bulk enter grades ─────────────────────────────────────────────────────
export const BulkEnterGradesDto = z.object({
    termId:         z.string().uuid(),
    classSubjectId: z.string().uuid(),
    grades: z.array(z.object({
        studentId: z.string().uuid(),
        caScore:   z.number().min(0).max(100).optional(),
        examScore: z.number().min(0).max(100).optional(),
    })).min(1),
});

// ── Update grade ──────────────────────────────────────────────────────────
export const UpdateGradeDto = z.object({
    caScore:   z.number().min(0).max(100).optional(),
    examScore: z.number().min(0).max(100).optional(),
});

// ── Publish grades ────────────────────────────────────────────────────────
export const PublishGradesDto = z.object({
    termId:         z.string().uuid(),
    classSubjectId: z.string().uuid().optional(),
});

// ── List grades ───────────────────────────────────────────────────────────
export const ListGradesDto = z.object({
    page:           z.string().optional(),
    limit:          z.string().optional(),
    studentId:      z.string().optional(),
    termId:         z.string().optional(),
    classSubjectId: z.string().optional(),
    isPublished:    z.string().optional(),
});

// ── Update grading config ─────────────────────────────────────────────────
export const UpdateGradingConfigDto = z.object({
    configs: z.array(z.object({
        minScore: z.number().min(0).max(100),
        maxScore: z.number().min(0).max(100),
        grade:    z.string(),
        remark:   z.string(),
    })).min(1),
});

export type EnterGradeDtoType          = z.infer<typeof EnterGradeDto>;
export type BulkEnterGradesDtoType     = z.infer<typeof BulkEnterGradesDto>;
export type UpdateGradeDtoType         = z.infer<typeof UpdateGradeDto>;
export type PublishGradesDtoType       = z.infer<typeof PublishGradesDto>;
export type ListGradesDtoType          = z.infer<typeof ListGradesDto>;
export type UpdateGradingConfigDtoType = z.infer<typeof UpdateGradingConfigDto>;