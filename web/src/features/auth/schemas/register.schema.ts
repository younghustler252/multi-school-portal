import { z } from "zod";

export const registerSchema = z.object({
	schoolName: z.string().min(2, "School name must be at least 2 characters").max(100, "School name is too long"),
	subdomain: z
		.string()
		.min(3, "Subdomain must be at least 3 characters")
		.max(50, "Subdomain is too long")
		.regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers and hyphens allowed"),
	schoolEmail: z.string().min(1, "School email is required").email("Enter a valid school email"),
	schoolPhone: z.string().optional(),
	schoolCategory: z.enum(["primary", "secondary", "primary_secondary"], {
		message: "Please select a school category",
	}),
	schoolOwnership: z.enum(["private", "public", "mission", "international"], {
		message: "Please select an ownership type",
	}),
	state: z.string().optional(),
	city: z.string().optional(),

	firstName: z.string().min(1, "First name is required").max(50, "First name is too long"),
	lastName: z.string().min(1, "Last name is required").max(50, "Last name is too long"),
	email: z.string().min(1, "Email is required").email("Enter a valid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[A-Z]/, "Must contain an uppercase letter")
		.regex(/[a-z]/, "Must contain a lowercase letter")
		.regex(/[0-9]/, "Must contain a number")
		.regex(/[^A-Za-z0-9]/, "Must contain a special character"),
	phone: z.string().optional(),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;