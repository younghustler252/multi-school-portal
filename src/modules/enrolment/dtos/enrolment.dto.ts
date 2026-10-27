import { z } from "zod";

/* ENROLMENT DTOs. Strict (unknown fields are rejected); text is trimmed; ids must be real ids. */
const id = z.string().uuid();
const reason = z.preprocess(v => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(300).optional());
const STATUSES = ["active", "withdrawn", "transferred", "completed"] as const;

export const EnrolStudentDto = z.object({ studentId: id, classId: id, termId: id }).strict();

// A whole list into one class (at most 200 students per request)
export const BulkEnrolDto = z.object({ studentIds: z.array(id).min(1).max(200), classId: id, termId: id }).strict();

// Change the status OR move the student to another class (not both at once)
export const UpdateEnrolmentDto = z.object({ status: z.enum(STATUSES).optional(), classId: id.optional(), reason })
    .strict()
    .refine(o => o.status !== undefined || o.classId !== undefined, "Send a new status or a new class")
    .refine(o => !(o.status !== undefined && o.classId !== undefined), "Change the status or the class, not both at once");

export const ListEnrolmentsQuery = z.object({
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
    classId:   id.optional(),
    termId:    id.optional(),                        // default: the current term
    studentId: id.optional(),
    status:    z.enum(STATUSES).optional(),
    search:    z.string().trim().max(100).optional(),
});

export const PromotionPreviewQuery = z.object({ termId: id, newTermId: id.optional() });

// The server works out who moves where from the saved class order. The browser only sends the exceptions.
export const PromotionOverrideDto = z.object({
    studentId: id,
    action:    z.enum(["promote", "repeat", "graduate", "exclude"]),
    classId:   id.optional(),                        // required for "promote", not allowed otherwise
}).strict().refine(o => (o.action === "promote") === (o.classId !== undefined), "Give a class for \"promote\", and only for \"promote\"");

export const PromoteStudentsDto = z.object({
    currentTermId: id,
    newTermId:     id,
    overrides:     z.array(PromotionOverrideDto).max(500).default([]),
}).strict();

export type EnrolStudentDtoType     = z.infer<typeof EnrolStudentDto>;
export type BulkEnrolDtoType        = z.infer<typeof BulkEnrolDto>;
export type UpdateEnrolmentDtoType  = z.infer<typeof UpdateEnrolmentDto>;
export type ListEnrolmentsQueryType = z.infer<typeof ListEnrolmentsQuery>;
export type PromotionPreviewQueryType = z.infer<typeof PromotionPreviewQuery>;
export type PromotionOverrideType   = z.infer<typeof PromotionOverrideDto>;
export type PromoteStudentsDtoType  = z.infer<typeof PromoteStudentsDto>;
