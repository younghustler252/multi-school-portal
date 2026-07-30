import { z } from "zod";

export const createStudentSchema = z.object({
	firstName: z.string().min(1, "First name is required").max(50),
	lastName: z.string().min(1, "Last name is required").max(50),
	middleName: z.string().optional(),
	admissionNumber: z.string().optional(),
	dateOfBirth: z.string().optional(),
	gender: z.enum(["male", "female"]).optional(),
	bloodGroup: z.string().optional(),
	address: z.string().optional(),
	religion: z.string().optional(),
	nationality: z.string().optional(),
	stateOfOrigin: z.string().optional(),
	admittedAt: z.string().optional(),

	guardianFirstName: z.string().optional(),
	guardianLastName: z.string().optional(),
	guardianEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
	guardianPhone: z.string().optional(),
	guardianRelation: z
		.enum(["father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other"])
		.optional(),
});

export type CreateStudentFormValues = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema
	.omit({ guardianFirstName: true, guardianLastName: true, guardianEmail: true, guardianPhone: true, guardianRelation: true })
	.partial();

export type UpdateStudentFormValues = z.infer<typeof updateStudentSchema>;