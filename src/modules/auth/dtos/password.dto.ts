import { z } from "zod";

/*
|--------------------------------------------------------------------------
| PASSWORD DTOs
| Forgot password + reset password + change password
|--------------------------------------------------------------------------
*/

export const ForgotPasswordDto = z.object({
    email: z.string().email(),
});

export const ResetPasswordDto = z.object({
    email:           z.string().email(),
    otp:             z.string().length(6, "OTP must be 6 digits"),
    newPassword:     z
                        .string()
                        .min(8)
                        .regex(/[A-Z]/, "Must contain uppercase letter")
                        .regex(/[a-z]/, "Must contain lowercase letter")
                        .regex(/[0-9]/, "Must contain a number")
                        .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
}).refine(
    data => data.newPassword === data.confirmPassword,
    {
        message: "Passwords do not match",
        path:    ["confirmPassword"],
    },
);

export const ChangePasswordDto = z.object({
    currentPassword: z.string().min(1),
    newPassword:     z
                        .string()
                        .min(8)
                        .regex(/[A-Z]/, "Must contain uppercase letter")
                        .regex(/[a-z]/, "Must contain lowercase letter")
                        .regex(/[0-9]/, "Must contain a number")
                        .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
}).refine(
    data => data.newPassword === data.confirmPassword,
    {
        message: "Passwords do not match",
        path:    ["confirmPassword"],
    },
);

export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType  = z.infer<typeof ResetPasswordDto>;
export type ChangePasswordDtoType = z.infer<typeof ChangePasswordDto>;