import { z } from "zod";

/*
|--------------------------------------------------------------------------
| STAFF DTOs
|--------------------------------------------------------------------------
*/

// ── Create staff ──────────────────────────────────────────────────────────
export const CreateStaffDto = z.object({
    // User account info
    email:         z.string().email(),
    firstName:     z.string().min(1).max(50),
    lastName:      z.string().min(1).max(50),
    phone:         z.string().optional(),
    password:      z.string().min(8).optional(), // auto-generated if not provided

    // Staff record info
    role:          z.enum([
                       "school_admin",
                       "principal",
                       "teacher",
                       "bursar",
                       "other",
                   ]),
    employeeId:    z.string().optional(),
    department:    z.string().optional(),
    designation:   z.string().optional(),
    qualification: z.string().optional(),
    gender:        z.enum(["male", "female"]).optional(),
    dateOfBirth:   z.string().optional(),
    address:       z.string().optional(),
    joinDate:      z.string().optional(),
});

// ── Update staff ──────────────────────────────────────────────────────────
export const UpdateStaffDto = z.object({
    firstName:     z.string().min(1).max(50).optional(),
    lastName:      z.string().min(1).max(50).optional(),
    phone:         z.string().optional(),
    role:          z.enum([
                       "school_admin",
                       "principal",
                       "teacher",
                       "bursar",
                       "other",
                   ]).optional(),
    employeeId:    z.string().optional(),
    department:    z.string().optional(),
    designation:   z.string().optional(),
    qualification: z.string().optional(),
    gender:        z.enum(["male", "female"]).optional(),
    dateOfBirth:   z.string().optional(),
    address:       z.string().optional(),
    joinDate:      z.string().optional(),
});

// ── List staff filters ────────────────────────────────────────────────────
export const ListStaffDto = z.object({
    page:       z.string().optional(),
    limit:      z.string().optional(),
    role:       z.string().optional(),
    department: z.string().optional(),
    search:     z.string().optional(),
    isActive:   z.string().optional(),
});

export type CreateStaffDtoType = z.infer<typeof CreateStaffDto>;
export type UpdateStaffDtoType = z.infer<typeof UpdateStaffDto>;
export type ListStaffDtoType   = z.infer<typeof ListStaffDto>;