import { z } from "zod";

export const forgotPasswordSchema = z.object({
	email: z.string().email("Enter a valid email address"),
});

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Must contain an uppercase letter")
	.regex(/[a-z]/, "Must contain a lowercase letter")
	.regex(/[0-9]/, "Must contain a number")
	.regex(/[^A-Za-z0-9]/, "Must contain a special character");

export const resetPasswordSchema = z
	.object({
		email: z.string().email(),
		otp: z.string().length(6, "Enter the 6-digit code"),
		newPassword: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;