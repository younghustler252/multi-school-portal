import { z } from "zod";

// ── Update profile ────────────────────────────────────────────────────────
export const UpdateProfileDto = z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName:  z.string().min(1).max(50).optional(),
    phone:     z.string().optional(),
});

// ── Change password ───────────────────────────────────────────────────────
export const ChangePasswordDto = z.object({
    currentPassword: z.string().min(1),
    newPassword:     z.string()
                        .min(8)
                        .regex(/[A-Z]/, "Must contain uppercase letter")
                        .regex(/[a-z]/, "Must contain lowercase letter")
                        .regex(/[0-9]/, "Must contain a number")
                        .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
}).refine(
    data => data.newPassword === data.confirmPassword,
    { message: "Passwords do not match", path: ["confirmPassword"] },
);

export type UpdateProfileDtoType  = z.infer<typeof UpdateProfileDto>;
export type ChangePasswordDtoType = z.infer<typeof ChangePasswordDto>;