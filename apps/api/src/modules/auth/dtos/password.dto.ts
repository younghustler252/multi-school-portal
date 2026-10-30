import { z } from "zod";
import { emailField, passwordField } from "./common";
import { otpField } from "./otp.dto";

export const ForgotPasswordDto = z.object({
    email: emailField,
});

export const ResetPasswordDto = z.object({
    email:           emailField,
    otp:             otpField,
    newPassword:     passwordField,
    confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path:    ["confirmPassword"],
});

// Used by the user module's change-password route
export const ChangePasswordDto = z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword:     passwordField,
    confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path:    ["confirmPassword"],
});

export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType  = z.infer<typeof ResetPasswordDto>;
export type ChangePasswordDtoType = z.infer<typeof ChangePasswordDto>;
