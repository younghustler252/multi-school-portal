import { z } from "zod";

/*
|--------------------------------------------------------------------------
| GUARDIAN DTOs
|--------------------------------------------------------------------------
*/

// ── Create guardian ───────────────────────────────────────────────────────
export const CreateGuardianDto = z.object({
    firstName:  z.string().min(1).max(50),
    lastName:   z.string().min(1).max(50),
    email:      z.string().email(),
    phone:      z.string().optional(),
    occupation: z.string().optional(),
    address:    z.string().optional(),

    // Link to student immediately
    studentId:  z.string().uuid(),
    relation:   z.enum([
                    "father",
                    "mother",
                    "uncle",
                    "aunt",
                    "grandparent",
                    "sibling",
                    "guardian",
                    "other",
                ]),
    isPrimary:  z.boolean().default(false),
});

// ── Update guardian ───────────────────────────────────────────────────────
export const UpdateGuardianDto = z.object({
    firstName:  z.string().min(1).max(50).optional(),
    lastName:   z.string().min(1).max(50).optional(),
    email:      z.string().email().optional(),
    phone:      z.string().optional(),
    occupation: z.string().optional(),
    address:    z.string().optional(),
});

// ── Link guardian to another student ─────────────────────────────────────
export const LinkGuardianDto = z.object({
    studentId: z.string().uuid(),
    relation:  z.enum([
                   "father",
                   "mother",
                   "uncle",
                   "aunt",
                   "grandparent",
                   "sibling",
                   "guardian",
                   "other",
               ]),
    isPrimary: z.boolean().default(false),
});

// ── Invite guardian to portal ─────────────────────────────────────────────
export const InviteGuardianDto = z.object({
    guardianId: z.string().uuid(),
});

// ── List guardians ────────────────────────────────────────────────────────
export const ListGuardiansDto = z.object({
    page:      z.string().optional(),
    limit:     z.string().optional(),
    studentId: z.string().optional(),
    search:    z.string().optional(),
});

export type CreateGuardianDtoType  = z.infer<typeof CreateGuardianDto>;
export type UpdateGuardianDtoType  = z.infer<typeof UpdateGuardianDto>;
export type LinkGuardianDtoType    = z.infer<typeof LinkGuardianDto>;
export type InviteGuardianDtoType  = z.infer<typeof InviteGuardianDto>;
export type ListGuardiansDtoType   = z.infer<typeof ListGuardiansDto>;