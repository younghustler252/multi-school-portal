// validations/auth.validation.ts
import { z } from "zod";

export const registerSchema = z.object({
    email: z
        .string()
        .email("Invalid email address"),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128)
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
            "Password must include uppercase, lowercase, number and special character"
        ),

    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),

    schoolName: z.string().min(1).optional(),
    role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional()
});

export const loginSchema = z.object({
    email: z.string().trim().email("Invalid email address"),
    password: z
        .string()
        .trim()
        .min(1, "Password is required")
        .max(128, "Password is too long") // optional, prevents DoS
});

