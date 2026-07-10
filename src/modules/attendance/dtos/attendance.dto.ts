import { z } from "zod";

/*
|--------------------------------------------------------------------------
| ATTENDANCE DTOs
|--------------------------------------------------------------------------
*/

// ── Mark single attendance ────────────────────────────────────────────────
export const MarkAttendanceDto = z.object({
    studentId: z.string().uuid(),
    termId:    z.string().uuid(),
    date:      z.string(),
    status:    z.enum(["present", "absent", "late", "excused"]),
    note:      z.string().optional(),
});

// ── Bulk mark attendance ──────────────────────────────────────────────────
export const BulkMarkAttendanceDto = z.object({
    termId:  z.string().uuid(),
    date:    z.string(),
    records: z.array(z.object({
        studentId: z.string().uuid(),
        status:    z.enum(["present", "absent", "late", "excused"]),
        note:      z.string().optional(),
    })).min(1),
});

// ── Update attendance ─────────────────────────────────────────────────────
export const UpdateAttendanceDto = z.object({
    status: z.enum(["present", "absent", "late", "excused"]),
    note:   z.string().optional(),
});

// ── List attendance filters ───────────────────────────────────────────────
export const ListAttendanceDto = z.object({
    page:      z.string().optional(),
    limit:     z.string().optional(),
    studentId: z.string().optional(),
    termId:    z.string().optional(),
    classId:   z.string().optional(),
    date:      z.string().optional(),
    status:    z.string().optional(),
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
});

export type MarkAttendanceDtoType     = z.infer<typeof MarkAttendanceDto>;
export type BulkMarkAttendanceDtoType = z.infer<typeof BulkMarkAttendanceDto>;
export type UpdateAttendanceDtoType   = z.infer<typeof UpdateAttendanceDto>;
export type ListAttendanceDtoType     = z.infer<typeof ListAttendanceDto>;