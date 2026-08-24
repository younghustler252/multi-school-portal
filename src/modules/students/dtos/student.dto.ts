import { z } from "zod";

/*
|--------------------------------------------------------------------------
| STUDENT DTOs
|--------------------------------------------------------------------------
*/

// ── Create student ────────────────────────────────────────────────────────
export const CreateStudentDto = z.object({
    firstName:       z.string().min(1).max(50),
    lastName:        z.string().min(1).max(50),
    middleName:      z.string().optional(),
    admissionNumber: z.string().optional(),
    dateOfBirth:     z.string().optional(),
    gender:          z.enum(["male", "female"]).optional(),
    bloodGroup:      z.string().optional(),
    address:         z.string().optional(),
    religion:        z.string().optional(),
    nationality:     z.string().optional(),
    stateOfOrigin:   z.string().optional(),
    admittedAt:      z.string().optional(),

    // Guardian info — optional at creation
    guardianFirstName: z.string().optional(),
    guardianLastName:  z.string().optional(),
    guardianEmail:     z.string().email().optional(),
    guardianPhone:     z.string().optional(),
    guardianRelation:  z.enum([
                           "father",
                           "mother",
                           "uncle",
                           "aunt",
                           "grandparent",
                           "sibling",
                           "guardian",
                           "other",
                       ]).optional(),
});

// ── Update student ────────────────────────────────────────────────────────
export const UpdateStudentDto = z.object({
    firstName:       z.string().min(1).max(50).optional(),
    lastName:        z.string().min(1).max(50).optional(),
    middleName:      z.string().optional(),
    admissionNumber: z.string().optional(),
    dateOfBirth:     z.string().optional(),
    gender:          z.enum(["male", "female"]).optional(),
    bloodGroup:      z.string().optional(),
    address:         z.string().optional(),
    religion:        z.string().optional(),
    nationality:     z.string().optional(),
    stateOfOrigin:   z.string().optional(),
    admittedAt:      z.string().optional(),
});

// ── List students filters ─────────────────────────────────────────────────
export const ListStudentsDto = z.object({
    page:     z.string().optional(),
    limit:    z.string().optional(),
    gender:   z.string().optional(),
    isActive: z.string().optional(),
    search:   z.string().optional(),
    classId: z.string().optional(),
});

export type CreateStudentDtoType = z.infer<typeof CreateStudentDto>;
export type UpdateStudentDtoType = z.infer<typeof UpdateStudentDto>;
export type ListStudentsDtoType  = z.infer<typeof ListStudentsDto>;