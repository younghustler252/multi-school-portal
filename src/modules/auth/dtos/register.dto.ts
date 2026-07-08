import { z } from "zod";

/*
|--------------------------------------------------------------------------
| REGISTER DTO
| School registration — creates school + admin user in one flow
|--------------------------------------------------------------------------
*/

export const RegisterDto = z.object({
    // ── School info ──────────────────────────────────────────────────────
    schoolName:      z.string().min(2).max(100),
    subdomain:       z
                        .string()
                        .min(3)
                        .max(50)
                        .regex(
                            /^[a-z0-9-]+$/,
                            "Subdomain can only contain lowercase letters, numbers and hyphens",
                        ),
    schoolEmail:     z.string().email(),
    schoolPhone:     z.string().optional(),
    schoolCategory:  z.enum(["primary", "secondary", "primary_secondary"]),
    schoolOwnership: z.enum(["private", "public", "mission", "international"]),
    state:           z.string().optional(),
    city:            z.string().optional(),

    // ── Admin info ───────────────────────────────────────────────────────
    firstName:       z.string().min(1).max(50),
    lastName:        z.string().min(1).max(50),
    email:           z.string().email(),
    password:        z
                        .string()
                        .min(8, "Password must be at least 8 characters")
                        .regex(/[A-Z]/, "Must contain uppercase letter")
                        .regex(/[a-z]/, "Must contain lowercase letter")
                        .regex(/[0-9]/, "Must contain a number")
                        .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    phone:           z.string().optional(),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;