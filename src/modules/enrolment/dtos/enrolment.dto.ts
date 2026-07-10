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

export type EnrolStudentDtoType    = z.infer<typeof EnrolStudentDto>;
export type BulkEnrolDtoType       = z.infer<typeof BulkEnrolDto>;
export type UpdateEnrolmentDtoType = z.infer<typeof UpdateEnrolmentDto>;
export type ListEnrolmentsDtoType  = z.infer<typeof ListEnrolmentsDto>;