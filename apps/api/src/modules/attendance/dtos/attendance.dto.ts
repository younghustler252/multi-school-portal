import { z } from "zod";
import { ATTENDANCE_STATUSES, DAY_PATTERN, MAX_REGISTER_ENTRIES } from "../domain/attendance.policy";

/* ATTENDANCE DTOs. Strict (unknown fields are rejected). A day is always "YYYY-MM-DD" (no times). */
const id = z.string().uuid();
const day = z.string().regex(DAY_PATTERN, "Use a date in the form YYYY-MM-DD");
const status = z.enum(ATTENDANCE_STATUSES);
const note = z.preprocess(v => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(300).nullable().optional());

export const RegisterQuery = z.object({ date: day });

// One whole register for one class and one day. The term is found from the date; the browser never sends it.
export const SubmitRegisterDto = z.object({
    date: day,
    entries: z.array(z.object({ studentId: id, status, note }).strict()).min(1).max(MAX_REGISTER_ENTRIES),
}).strict();

export const UpdateAttendanceDto = z.object({ status: status.optional(), note })
    .strict()
    .refine(o => o.status !== undefined || o.note !== undefined, "Send a new status or a new note");

export const ListAttendanceQuery = z.object({
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
    studentId: id.optional(),
    classId:   id.optional(),
    termId:    id.optional(),
    from:      day.optional(),
    to:        day.optional(),
    status:    status.optional(),
});

export const StudentSummaryQuery = z.object({ studentId: id, termId: id.optional() });   // default: the current term
export const ClassSummaryQuery   = z.object({ termId: id.optional() });

export type SubmitRegisterDtoType     = z.infer<typeof SubmitRegisterDto>;
export type UpdateAttendanceDtoType   = z.infer<typeof UpdateAttendanceDto>;
export type ListAttendanceQueryType   = z.infer<typeof ListAttendanceQuery>;
export type StudentSummaryQueryType   = z.infer<typeof StudentSummaryQuery>;
export type ClassSummaryQueryType     = z.infer<typeof ClassSummaryQuery>;
