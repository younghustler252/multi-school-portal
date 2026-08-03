import { z } from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Must contain an uppercase letter")
	.regex(/[a-z]/, "Must contain a lowercase letter")
	.regex(/[0-9]/, "Must contain a number")
	.regex(/[^A-Za-z0-9]/, "Must contain a special character")
	.optional()
	.or(z.literal(""));

export const createStaffSchema = z.object({
	email: z.string().email("Enter a valid email"),
	firstName: z.string().min(1, "First name is required").max(50),
	lastName: z.string().min(1, "Last name is required").max(50),
	phone: z.string().optional(),
	password: passwordSchema,

	role: z.enum(["school_admin", "principal", "teacher", "bursar", "other"]),
	employeeId: z.string().optional(),
	department: z.string().optional(),
	designation: z.string().optional(),
	qualification: z.string().optional(),
	gender: z.enum(["male", "female"]).optional(),
	dateOfBirth: z.string().optional(),
	address: z.string().optional(),
	joinDate: z.string().optional(),
});

export type CreateStaffFormValues = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.omit({ email: true, password: true }).partial();

export type UpdateStaffFormValues = z.infer<typeof updateStaffSchema>;