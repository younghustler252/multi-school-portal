import { z } from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Must contain an uppercase letter")
	.regex(/[a-z]/, "Must contain a lowercase letter")
	.regex(/[0-9]/, "Must contain a number")
	.regex(/[^A-Za-z0-9]/, "Must contain a special character");

export const acceptInviteSchema = z
	.object({
		firstName: z.string().min(1, "First name is required").max(50),
		lastName: z.string().min(1, "Last name is required").max(50),
		password: passwordSchema,
		confirmPassword: z.string(),
		phone: z.string().optional(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export type AcceptInviteFormValues = z.infer<typeof acceptInviteSchema>;