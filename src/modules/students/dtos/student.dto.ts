import { z } from "zod";

/*
| STUDENT DTOs. Text is trimmed and bounded; blank strings count as "not sent" (create) or "clear it" (update).
| Unknown fields are rejected (.strict()), so a typo or an old field never silently does nothing.
*/
const blank = (to: undefined | null) => (v: unknown) => (typeof v === "string" && v.trim() === "" ? to : v);
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => z.preprocess(blank(undefined), text(max).optional());
const clearText = (max: number) => z.preprocess(blank(null), text(max).nullable().optional());

const GENDERS      = ["male", "female"] as const;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const validDate = (v: string) => !Number.isNaN(Date.parse(v));
const birthDate = z.string().refine(v => validDate(v) && new Date(v) < new Date() && new Date(v).getUTCFullYear() >= 1980, "Enter a valid date of birth");
// An admission date may be a little ahead of today (a place accepted for next term), not years ahead
const admitDate = z.string().refine(v => validDate(v) && new Date(v).getTime() < Date.now() + 366 * 24 * 3600 * 1000 && new Date(v).getUTCFullYear() >= 2000, "Enter a valid admission date");

const admissionNumber = z.string().trim().regex(/^[A-Za-z0-9\-\/._]{2,30}$/, "Use letters, numbers, - / . or _ (2 to 30 characters)");

// ── Create student ────────────────────────────────────────────────────────
export const CreateStudentDto = z.object({
    firstName:       z.string().trim().min(1).max(50),
    lastName:        z.string().trim().min(1).max(50),
    middleName:      optText(50),
    admissionNumber: z.preprocess(blank(undefined), admissionNumber.optional()),   // left out = made automatically
    dateOfBirth:     z.preprocess(blank(undefined), birthDate.optional()),
    gender:          z.preprocess(blank(undefined), z.enum(GENDERS).optional()),
    bloodGroup:      z.preprocess(blank(undefined), z.enum(BLOOD_GROUPS).optional()),
    address:         optText(300),
    religion:        optText(50),
    nationality:     optText(50),
    stateOfOrigin:   optText(50),
    admittedAt:      z.preprocess(blank(undefined), admitDate.optional()),
    confirmNotDuplicate: z.boolean().optional(),
}).strict();

// ── Update student (send only what changes; null or "" clears an optional field) ──
export const UpdateStudentDto = z.object({
    firstName:       z.string().trim().min(1).max(50).optional(),
    lastName:        z.string().trim().min(1).max(50).optional(),
    middleName:      clearText(50),
    admissionNumber: admissionNumber.optional(),                                   // cannot be cleared
    dateOfBirth:     z.preprocess(blank(null), birthDate.nullable().optional()),
    gender:          z.preprocess(blank(null), z.enum(GENDERS).nullable().optional()),
    bloodGroup:      z.preprocess(blank(null), z.enum(BLOOD_GROUPS).nullable().optional()),
    address:         clearText(300),
    religion:        clearText(50),
    nationality:     clearText(50),
    stateOfOrigin:   clearText(50),
    admittedAt:      z.preprocess(blank(null), admitDate.nullable().optional()),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change");

export const DeactivateStudentDto = z.object({
    reason: optText(300),
}).strict().default({});

// ── List students (parsed in the controller: the validate middleware does not write query values back) ──
export const ListStudentsQuery = z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    gender: z.enum(GENDERS).optional(),
    status: z.enum(["active", "inactive", "all"]).default("active"),
});

// ── CSV import row (used by the import use case, which is not switched on yet) ──
export const ImportStudentRowSchema = z.object({
    firstName:        z.string().min(1),
    lastName:         z.string().min(1),
    middleName:       z.string().optional(),
    admissionNumber:  z.string().optional(),
    dateOfBirth:      z.string().optional(), // "YYYY-MM-DD"
    gender:           z.enum(GENDERS).optional(),
    className:        z.string().optional(), // matched against existing Class.name, enrolled if found
    guardianEmail:    z.string().email().optional(),
    guardianFirstName: z.string().optional(),
    guardianLastName:  z.string().optional(),
    guardianPhone:     z.string().optional(),
    guardianRelation:  z.enum(["father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other"]).optional(),
});

export type CreateStudentDtoType     = z.infer<typeof CreateStudentDto>;
export type UpdateStudentDtoType     = z.infer<typeof UpdateStudentDto>;
export type DeactivateStudentDtoType = z.infer<typeof DeactivateStudentDto>;
export type ListStudentsQueryType    = z.infer<typeof ListStudentsQuery>;
