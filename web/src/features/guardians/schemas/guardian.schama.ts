import { z } from "zod";

const relationEnum = z.enum([
	"father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other",
]);

export const createGuardianSchema = z.object({
	firstName: z.string().min(1, "First name is required").max(50),
	lastName: z.string().min(1, "Last name is required").max(50),
	email: z.string().email("Enter a valid email"),
	phone: z.string().optional(),
	occupation: z.string().optional(),
	address: z.string().optional(),

	studentId: z.string().uuid("Select a student"),
	relation: relationEnum,
	isPrimary: z.boolean().default(false),
});

export type CreateGuardianFormValues = z.infer<typeof createGuardianSchema>;

export const updateGuardianSchema = z.object({
	firstName: z.string().min(1).max(50).optional(),
	lastName: z.string().min(1).max(50).optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	occupation: z.string().optional(),
	address: z.string().optional(),
});

export type UpdateGuardianFormValues = z.infer<typeof updateGuardianSchema>;

export const linkGuardianSchema = z.object({
	studentId: z.string().uuid("Select a student"),
	relation: relationEnum,
	isPrimary: z.boolean(),
});
export type LinkGuardianFormValues = z.infer<typeof linkGuardianSchema>;