import { z } from "zod";

// Mirrors CreateStaffDto in apps/api/src/modules/staff/dtos/staff.dto.ts. Blank optional inputs are dropped before sending.
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createStaffSchema = z.object({
	firstName: z.string().trim().min(1, "First name is required").max(50),
	lastName: z.string().trim().min(1, "Last name is required").max(50),
	middleName: optionalText(50),
	email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
	phone: z.union([z.literal(""), z.string().trim().min(7, "Phone is too short").max(30)]).optional(),
	gender: z.enum(["male", "female"]).optional(),
	dateOfBirth: z.string().optional(),
	address: optionalText(200),
	department: optionalText(100),
	designation: optionalText(100),
	qualification: optionalText(200),
	category: z.enum(["teaching", "non_teaching"]),
	employmentType: z.enum(["full_time", "part_time", "contract", "volunteer"]),
	joinDate: z.string().optional(),
	employeeId: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9\-/]{2,30}$/, "Use letters, numbers, - or /")]).optional(),
});

export type CreateStaffFormValues = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial();

export type UpdateStaffFormValues = z.infer<typeof updateStaffSchema>;
