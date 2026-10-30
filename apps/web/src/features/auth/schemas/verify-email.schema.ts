import { z } from "zod";

export const verifyEmailSchema = z.object({
	email: z.string().email(),
	otp: z.string().length(6, "Enter the 6-digit code"),
});

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;