import { z } from "zod";
import { emailField, passwordField } from "./common";

export const RegisterDto = z.object({
    // ── School ───────────────────────────────────────────────────────────
    schoolName:      z.string().trim().min(2).max(100),
    subdomain:       z.string().trim().toLowerCase().min(3).max(50)
                        .regex(
                            /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
                            "Subdomain can only contain lowercase letters, numbers and hyphens, and cannot start or end with a hyphen",
                        ),
    schoolEmail:     emailField,
    schoolPhone:     z.string().trim().max(30).optional(),
    schoolCategory:  z.enum(["primary", "secondary", "primary_secondary"]),
    schoolOwnership: z.enum(["private", "public", "mission", "international"]),
    state:           z.string().trim().max(100).optional(),
    city:            z.string().trim().max(100).optional(),

    // ── Admin ────────────────────────────────────────────────────────────
    firstName:       z.string().trim().min(1).max(50),
    lastName:        z.string().trim().min(1).max(50),
    email:           emailField,
    password:        passwordField,
    phone:           z.string().trim().max(30).optional(),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
